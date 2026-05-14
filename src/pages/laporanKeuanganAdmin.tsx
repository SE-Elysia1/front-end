 
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./dashboardAdmin.css";
import "./laporanKeuanganAdmin.css";

const BASEURL = import.meta.env.VITE_BASEURL;
const COIN_TO_IDR = 2000;

type AdminLogEntry = {
  id: number;
  userId: number;
  username?: string | null;
  type: string;
  coins: number;
  description: string;
  pcId: number | null;
  createdAt: number;
  displayDate: string;
};

const toNumber = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

const toNonEmptyString = (value: unknown) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const toDateMs = (value: number) => (value < 1_000_000_000_000 ? value * 1000 : value);

const formatRupiah = (value: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);

const formatDateLocal = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const getDefaultRange = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { startDate: formatDateLocal(start), endDate: formatDateLocal(end) };
};

const resolvePcId = () => {
  const fromStorage = Number.parseInt(localStorage.getItem("pcId")?.trim() ?? "", 10);
  if (Number.isFinite(fromStorage) && fromStorage > 0) return fromStorage;
  const fromEnv = Number.parseInt((import.meta.env.VITE_PC_ID as string | undefined)?.trim() ?? "", 10);
  if (Number.isFinite(fromEnv) && fromEnv > 0) return fromEnv;
  return null;
};

const escapePdfText = (value: string) =>
  value
    .replaceAll("\\", "\\\\")
    .replaceAll("(", "\\(")
    .replaceAll(")", "\\)");

const formatDateReadable = (value: string) => {
  if (!value) return "-";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric" }).format(date);
};

const wrapText = (text: string, maxChars: number) => {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [""];
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines;
};

const buildPdfBytes = (lines: string[]) => {
  const pageWidth = 595;
  const pageHeight = 842;
  const marginLeft = 40;
  const marginTop = 40;
  const lineHeight = 16;
  const maxLinesPerPage = Math.floor((pageHeight - marginTop * 2) / lineHeight);

  const pages: string[][] = [];
  for (let i = 0; i < lines.length; i += maxLinesPerPage) {
    pages.push(lines.slice(i, i + maxLinesPerPage));
  }
  if (!pages.length) pages.push(["Laporan kosong"]);

  const objects: string[] = [];
  const addObject = (content: string) => {
    objects.push(content);
    return objects.length;
  };

  const catalogId = addObject("");
  const pagesId = addObject("");
  const fontId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");

  const pageIds: number[] = [];
  for (const pageLines of pages) {
    const contentLines: string[] = ["BT", "/F1 12 Tf"];
    let y = pageHeight - marginTop;
    for (const line of pageLines) {
      const escaped = escapePdfText(line);
      contentLines.push(`1 0 0 1 ${marginLeft} ${y} Tm (${escaped}) Tj`);
      y -= lineHeight;
    }
    contentLines.push("ET");
    const stream = contentLines.join("\n");
    const contentId = addObject(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
    const pageId = addObject(
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`,
    );
    pageIds.push(pageId);
  }

  objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];
  for (let i = 0; i < objects.length; i += 1) {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xrefPos = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i <= objects.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefPos}\n%%EOF`;
  return new TextEncoder().encode(pdf);
};

export default function LaporanKeuanganAdmin() {
  const navigate = useNavigate();
  const [logs, setLogs] = useState<AdminLogEntry[]>([]);
  const [usernameByUserId, setUsernameByUserId] = useState<Record<number, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [{ startDate, endDate }, setRange] = useState(getDefaultRange);
  const [userId] = useState(() => localStorage.getItem("userId")?.trim() ?? "");
  const [localUsername] = useState(() => localStorage.getItem("username")?.trim() ?? "");
  const [authToken] = useState(() => localStorage.getItem("token")?.trim() ?? "");
  const [role] = useState(() => localStorage.getItem("role")?.toLowerCase() ?? "user");


  const fetchingUserIds = useRef<Set<number>>(new Set());

  const displayUsername = useCallback(
    (log: AdminLogEntry) => {
      const fromLog = typeof log.username === "string" ? log.username.trim() : "";
      if (fromLog) return fromLog;

      const fromResolved = usernameByUserId[log.userId];
      if (fromResolved) return fromResolved;

      const localUserId = Number.parseInt(userId ?? "", 10);
      if (Number.isFinite(localUserId) && localUserId === log.userId && localUsername) {
        return localUsername;
      }

      return `User #${log.userId}`;
    },
    [localUsername, userId, usernameByUserId],
  );

  const fetchLogs = useCallback(async () => {
    if (!userId || !authToken) return;
    const response = await fetch(`${BASEURL}/api/logs?requestingUserId=${userId}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    if (!response.ok) throw new Error("Gagal ambil logs");
    const payload: unknown = await response.json();
    const rows = Array.isArray(payload) ? payload : [];
    const data: AdminLogEntry[] = rows
      .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
      .map((item) => ({
        id: toNumber(item.id) ?? 0,
        userId: toNumber(item.userId) ?? 0,
        username:
          toNonEmptyString(item.username) ??
          toNonEmptyString(item.userName) ??
          toNonEmptyString(item.name),
        type: toNonEmptyString(item.type) ?? "-",
        coins: toNumber(item.coins) ?? 0,
        description: toNonEmptyString(item.description) ?? "-",
        pcId: toNumber(item.pcId),
        createdAt: toNumber(item.createdAt) ?? 0,
        displayDate: toNonEmptyString(item.displayDate) ?? "-",
      }));
    const sorted = data.sort((a, b) => b.createdAt - a.createdAt);
    setLogs(sorted);
  }, [authToken, userId]);
 
  const fetchMissingUsernames = useCallback(async () => {
    if (!authToken) return;


    const ids = Array.from(new Set(logs.map((log) => log.userId))).filter(
      (id) => !fetchingUserIds.current.has(id),
    );

   
    if (!ids.length) return;


    for (const id of ids) fetchingUserIds.current.add(id);

    const resolved: Record<number, string> = {};

    for (const id of ids) {
      try {
        const response = await fetch(`${BASEURL}/api/user/${id}`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (!response.ok) continue;
        const payload: unknown = await response.json();
        if (!payload || typeof payload !== "object") continue;
        const obj = payload as Record<string, unknown>;
        const username =
          toNonEmptyString(obj.username) ??
          toNonEmptyString(obj.userName) ??
          toNonEmptyString(obj.name);
        if (username) resolved[id] = username;
      } catch {
        // Network error for one user shouldn't block others; continue.
      }
    }

  
    if (Object.keys(resolved).length > 0) {
    
      setUsernameByUserId((prev) => ({ ...prev, ...resolved }));
    }
  }, [authToken, logs]);


  useEffect(() => {
    if (role !== "admin") {
      navigate("/app/dashboard", { replace: true });
      return;
    }
    const load = async () => {
      setIsLoading(true);
      setErrorMessage("");
      try {
        await fetchLogs();
      } catch {
        setErrorMessage("Gagal memuat data laporan.");
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [fetchLogs, navigate, role]);

  useEffect(() => {
    fetchMissingUsernames();
  }, [fetchMissingUsernames]);

  const filteredLogs = useMemo(() => {
    const startMs = startDate ? new Date(`${startDate}T00:00:00`).getTime() : null;
    const endMs = endDate ? new Date(`${endDate}T23:59:59.999`).getTime() : null;

    return logs.filter((log) => {
      const createdMs = toDateMs(log.createdAt);
      if (startMs !== null && createdMs < startMs) return false;
      if (endMs !== null && createdMs > endMs) return false;
      return true;
    });
  }, [endDate, logs, startDate]);

  const totalIncomeIdr = useMemo(() => {
    const topups = filteredLogs.filter((log) => log.type === "topup" && log.coins > 0);
    const totalCoin = topups.reduce((sum, log) => sum + log.coins, 0);
    return totalCoin * COIN_TO_IDR;
  }, [filteredLogs]);

  const totalTransactions = useMemo(() => filteredLogs.length, [filteredLogs]);

  const handleLogout = async () => {
    const pcId = resolvePcId();
    try {
      if (pcId) {
        await fetch(`${BASEURL}/api/logout`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
          },
          body: JSON.stringify({ pcId }),
        });
      }
    } finally {
      localStorage.clear();
      navigate("/login");
    }
  };

  const downloadPdf = () => {
    const periodText = `${formatDateReadable(startDate)} - ${formatDateReadable(endDate)}`;
    const lines: string[] = [
      "LAPORAN KEUANGAN ADMIN",
      `Periode: ${periodText}`,
      "",
      `Total Pendapatan: ${formatRupiah(totalIncomeIdr)}`,
      `Total Transaksi: ${totalTransactions} Transaksi`,
      "",
      "RIWAYAT TRANSAKSI",
      "PC | User | Jenis Transaksi | Nominal | Waktu",
      "------------------------------------------------------------",
    ];

    if (!filteredLogs.length) {
      lines.push("Tidak ada transaksi pada periode ini.");
    } else {
      for (const log of filteredLogs) {
        const rowPrefix = `${log.pcId ? `PC ${log.pcId}` : "-"} | ${displayUsername(log)} | `;
        const suffix = ` | ${Math.abs(log.coins)} Coin | ${log.displayDate || "-"}`;
        const descLines = wrapText(log.description || log.type || "-", 48);
        lines.push(`${rowPrefix}${descLines[0]}${suffix}`);
        for (let i = 1; i < descLines.length; i += 1) {
          lines.push(`    |     | ${descLines[i]}`);
        }
      }
    }

    const bytes = buildPdfBytes(lines);
    const blob = new Blob([bytes], { type: "application/pdf" });
    const fileName = `laporan-keuangan-${startDate || "awal"}_sampai_${endDate || "akhir"}.pdf`;
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const openDatePicker = (input: HTMLInputElement | null) => {
    if (!input) return;
    input.focus();
    if ("showPicker" in input) {
      (input as HTMLInputElement & { showPicker?: () => void }).showPicker?.();
    }
  };

  return (
    <section className="admin-dashboard-page">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <span className="admin-brand-icon" aria-hidden="true">
            BW
          </span>
          <div>
            <p className="admin-brand-title">Billing Warnet</p>
            <p className="admin-brand-subtitle">Sistem Billing Digital</p>
          </div>
        </div>
        <nav className="admin-nav">
          <button className="admin-nav-item" type="button" onClick={() => navigate("/app/dashboard-admin")}>
            <span className="admin-nav-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M3 10.5L12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1V10.5Z" />
              </svg>
            </span>
            Dashboard
          </button>
          <button className="admin-nav-item" type="button" onClick={() => navigate("/app/monitoring-admin")}>
            <span className="admin-nav-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M12 3v4" />
                <path d="M12 17v4" />
                <path d="M3 12h4" />
                <path d="M17 12h4" />
                <rect x="7" y="7" width="10" height="10" rx="2" />
              </svg>
            </span>
            Monitoring PC
          </button>
          <button className="admin-nav-item" type="button" onClick={() => navigate("/app/kelola-user-admin")}>
            <span className="admin-nav-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
                <circle cx="9.5" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </span>
            Kelola User
          </button>
          <button className="admin-nav-item" type="button" onClick={() => navigate("/app/history-admin")}>
            <span className="admin-nav-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M4 12a8 8 0 1 0 2.3-5.7L4 8.6" />
                <path d="M4 4v4.6h4.6" />
                <path d="M12 8v4l3 2" />
              </svg>
            </span>
            Riwayat Transaksi
          </button>
          <button className="admin-nav-item active" type="button">
            <span className="admin-nav-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M6 4h12v3H6z" />
                <path d="M6 10h12v3H6z" />
                <path d="M6 16h12v3H6z" />
              </svg>
            </span>
            Laporan Keuangan
          </button>
        </nav>
      </aside>

      <main className="admin-main">
        <header className="admin-header">
          <h2>Halo, Admin!</h2>
          <button type="button" className="btn admin-logout-btn" onClick={handleLogout}>
            Log Out
          </button>
        </header>

        <div className="admin-finance-filters">
          <label className="admin-finance-date">
            <span className="sr-only">Tanggal Mulai</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setRange((prev) => ({ ...prev, startDate: e.target.value }))}
              onClick={(e) => openDatePicker(e.currentTarget)}
              aria-label="Tanggal Mulai"
            />
            <button
              type="button"
              className="admin-finance-date-icon"
              aria-label="Pilih Tanggal Mulai"
              onClick={(e) => {
                const input = e.currentTarget.parentElement?.querySelector("input[type='date']") as HTMLInputElement | null;
                openDatePicker(input);
              }}
            >
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M8 3v3" />
                <path d="M16 3v3" />
                <rect x="4" y="6" width="16" height="14" rx="2" />
                <path d="M4 10h16" />
              </svg>
            </button>
          </label>
          <span className="admin-finance-date-sep" aria-hidden="true">
            —
          </span>
          <label className="admin-finance-date">
            <span className="sr-only">Tanggal Akhir</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setRange((prev) => ({ ...prev, endDate: e.target.value }))}
              onClick={(e) => openDatePicker(e.currentTarget)}
              aria-label="Tanggal Akhir"
            />
            <button
              type="button"
              className="admin-finance-date-icon"
              aria-label="Pilih Tanggal Akhir"
              onClick={(e) => {
                const input = e.currentTarget.parentElement?.querySelector("input[type='date']") as HTMLInputElement | null;
                openDatePicker(input);
              }}
            >
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M8 3v3" />
                <path d="M16 3v3" />
                <rect x="4" y="6" width="16" height="14" rx="2" />
                <path d="M4 10h16" />
              </svg>
            </button>
          </label>
        </div>

        <div className="admin-finance-summary">
          <article className="card admin-finance-stat income">
            <p>Total Pendapatan</p>
            <h3>{isLoading ? "..." : formatRupiah(totalIncomeIdr)}</h3>
          </article>
          <article className="card admin-finance-stat tx">
            <p>Total Transaksi</p>
            <h3>{isLoading ? "..." : `${totalTransactions} Transaksi`}</h3>
          </article>
        </div>

        <section className="card admin-finance-history-card" aria-label="Riwayat Transaksi Periode">
          <h3>Riwayat Transaksi</h3>
          <div className="admin-history-head">
            <span>PC</span>
            <span>User</span>
            <span>Jenis Transaksi</span>
            <span>Nominal</span>
            <span>Waktu</span>
          </div>
          <div className="admin-history-body admin-finance-history-body">
            {isLoading ? (
              <div className="admin-finance-empty">Memuat riwayat...</div>
            ) : errorMessage ? (
              <div className="admin-finance-empty">{errorMessage}</div>
            ) : filteredLogs.length === 0 ? (
              <div className="admin-finance-empty">Belum ada transaksi.</div>
            ) : (
              filteredLogs.map((log) => (
                <div key={log.id} className="admin-history-row">
                  <span>{log.pcId ? `PC ${log.pcId}` : "-"}</span>
                  <span className="admin-finance-username">{displayUsername(log)}</span>
                  <span className="admin-finance-desc">{log.description}</span>
                  <span>{Math.abs(log.coins)} Coin</span>
                  <span>{log.displayDate}</span>
                </div>
              ))
            )}
          </div>
        </section>

        <div className="admin-finance-actions">
          <button type="button" className="btn admin-finance-pdf" onClick={downloadPdf} disabled={isLoading}>
            Download PDF
          </button>
        </div>
      </main>
    </section>
  );
}