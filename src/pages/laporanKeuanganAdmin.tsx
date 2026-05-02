import { useCallback, useEffect, useMemo, useState } from "react";
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

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

export default function LaporanKeuanganAdmin() {
  const navigate = useNavigate();
  const [logs, setLogs] = useState<AdminLogEntry[]>([]);
  const [usernameByUserId, setUsernameByUserId] = useState<Record<number, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [{ startDate, endDate }, setRange] = useState(getDefaultRange);

  const userId = useMemo(() => localStorage.getItem("userId"), []);
  const localUsername = useMemo(() => localStorage.getItem("username")?.trim() ?? "", []);
  const authToken = useMemo(() => localStorage.getItem("token")?.trim() ?? "", []);
  const role = useMemo(() => localStorage.getItem("role")?.toLowerCase() ?? "user", []);

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
    const ids = Array.from(new Set(logs.map((log) => log.userId))).filter((id) => !usernameByUserId[id]);
    if (!ids.length) return;

    const next = { ...usernameByUserId };
    for (const id of ids) {
      try {
        const response = await fetch(`${BASEURL}/api/user/${id}`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (!response.ok) continue;
        const payload: unknown = await response.json();
        if (!payload || typeof payload !== "object") continue;
        const obj = payload as Record<string, unknown>;
        const username = toNonEmptyString(obj.username) ?? toNonEmptyString(obj.userName) ?? toNonEmptyString(obj.name);
        if (username) next[id] = username;
      } catch {
        // ignore
      }
    }
    setUsernameByUserId(next);
  }, [authToken, logs, usernameByUserId]);

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

  const handleLogout = () => {
    localStorage.clear();
    navigate("/login");
  };

  const downloadPdf = () => {
    const title = "Laporan Keuangan";
    const safePeriod = `${startDate || "-"} — ${endDate || "-"}`;
    const rowsHtml = filteredLogs
      .map((log) => {
        const pcText = log.pcId ? `PC ${log.pcId}` : "-";
        const userText = displayUsername(log);
        const typeText = log.description || log.type;
        const nominalText = `${Math.abs(log.coins)} Coin`;
        const timeText = log.displayDate || "-";
        return `
          <tr>
            <td>${escapeHtml(pcText)}</td>
            <td>${escapeHtml(userText)}</td>
            <td class="type">${escapeHtml(typeText)}</td>
            <td class="num">${escapeHtml(nominalText)}</td>
            <td class="num">${escapeHtml(timeText)}</td>
          </tr>
        `;
      })
      .join("");

    const html = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${escapeHtml(title)}</title>
          <style>
            :root { color-scheme: light; }
            body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial; padding: 24px; }
            h1 { font-size: 20px; margin: 0 0 8px; }
            .muted { color: #4b5563; font-weight: 600; margin: 0 0 18px; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin: 16px 0 18px; }
            .card { border: 1px solid #e5e7eb; border-radius: 14px; padding: 14px 16px; }
            .card .label { color: #4b5563; font-weight: 700; margin: 0 0 6px; }
            .card .value { font-size: 18px; font-weight: 900; margin: 0; }
            table { width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb; border-radius: 14px; overflow: hidden; }
            thead th { text-align: left; font-size: 12px; padding: 10px 12px; color: #6b7280; border-bottom: 1px solid #e5e7eb; }
            tbody td { padding: 10px 12px; border-bottom: 1px solid #f1f5f9; vertical-align: top; font-weight: 650; font-size: 13px; }
            tbody tr:last-child td { border-bottom: none; }
            .num { text-align: right; white-space: nowrap; }
            .type { white-space: pre-line; }
            @page { size: A4; margin: 12mm; }
          </style>
        </head>
        <body>
          <h1>${escapeHtml(title)}</h1>
          <p class="muted">Periode: ${escapeHtml(safePeriod)}</p>
          <div class="grid">
            <div class="card">
              <p class="label">Total Pendapatan</p>
              <p class="value">${escapeHtml(formatRupiah(totalIncomeIdr))}</p>
            </div>
            <div class="card">
              <p class="label">Total Transaksi</p>
              <p class="value">${escapeHtml(`${totalTransactions} Transaksi`)}</p>
            </div>
          </div>
          <h2 style="font-size:14px; margin:0 0 10px;">Riwayat Transaksi</h2>
          <table>
            <thead>
              <tr>
                <th>PC</th>
                <th>User</th>
                <th>Jenis Transaksi</th>
                <th class="num">Nominal</th>
                <th class="num">Waktu</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml || `<tr><td colspan="5" style="padding:14px; color:#6b7280;">Tidak ada transaksi pada periode ini.</td></tr>`}
            </tbody>
          </table>
          <script>
            window.onload = () => { window.print(); };
          </script>
        </body>
      </html>
    `;

    const win = window.open("", "_blank", "noopener,noreferrer");
    if (!win) return;
    win.document.open();
    win.document.write(html);
    win.document.close();
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
              aria-label="Tanggal Mulai"
            />
            <span className="admin-finance-date-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M8 3v3" />
                <path d="M16 3v3" />
                <rect x="4" y="6" width="16" height="14" rx="2" />
                <path d="M4 10h16" />
              </svg>
            </span>
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
              aria-label="Tanggal Akhir"
            />
            <span className="admin-finance-date-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M8 3v3" />
                <path d="M16 3v3" />
                <rect x="4" y="6" width="16" height="14" rx="2" />
                <path d="M4 10h16" />
              </svg>
            </span>
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

