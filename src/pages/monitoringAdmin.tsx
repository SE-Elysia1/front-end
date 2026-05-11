import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./dashboardAdmin.css";
import "./monitoringAdmin.css";

const BASEURL = import.meta.env.VITE_BASEURL;

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

const pad2 = (value: number) => String(Math.max(0, value)).padStart(2, "0");

const formatDuration = (seconds: number) => {
  const safe = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  return `${pad2(hours)}:${pad2(minutes)}:${pad2(secs)}`;
};

const resolvePcId = () => {
  const fromStorage = Number.parseInt(localStorage.getItem("pcId")?.trim() ?? "", 10);
  if (Number.isFinite(fromStorage) && fromStorage > 0) return fromStorage;
  const fromEnv = Number.parseInt((import.meta.env.VITE_PC_ID as string | undefined)?.trim() ?? "", 10);
  if (Number.isFinite(fromEnv) && fromEnv > 0) return fromEnv;
  return null;
};

type PcEntry = {
  id: number;
  pcNumber: string;
  status: string;
  sessionEndTime: number | null; 
};

export default function MonitoringAdmin() {
  const navigate = useNavigate();
  const [pcs, setPcs] = useState<PcEntry[]>([]);
  const [tick, setTick] = useState(0);


  const [authToken] = useState(() => localStorage.getItem("token")?.trim() ?? "");
  const [role] = useState(() => localStorage.getItem("role")?.toLowerCase() ?? "user");

  const fetchPcs = useCallback(async () => {
    if (!authToken) return;
    try {
      const response = await fetch(`${BASEURL}/api/pcs`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (!response.ok) return;
      const payload: unknown = await response.json();

  
      const rawRows =
        payload &&
        typeof payload === "object" &&
        Array.isArray((payload as Record<string, unknown>).data)
          ? (payload as Record<string, unknown>).data
          : payload;
      const rows: unknown[] = Array.isArray(rawRows) ? rawRows : [];

      const entries: PcEntry[] = rows
        .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
        .map((item) => {
          const rawEndTime = toNumber(item.sessionEndTime);
          return {
            id: toNumber(item.id) ?? 0,
            pcNumber: toNonEmptyString(item.pcNumber) ?? "-",
            status: toNonEmptyString(item.status) ?? "vacant",
            // Normalise to ms; null stays null.
            sessionEndTime: rawEndTime !== null ? toDateMs(rawEndTime) : null,
          };
        })
        .filter((pc) => pc.id > 0)
        .sort((a, b) => a.id - b.id);

      setPcs(entries);
    } catch {
      // Network failure — keep previous state so the grid doesn't go blank.
    }
  }, [authToken]);

  useEffect(() => {
    if (role !== "admin") {
      navigate("/app/dashboard", { replace: true });
      return;
    }
    fetchPcs();
    const poll = window.setInterval(fetchPcs, 15_000);
    return () => window.clearInterval(poll);
  }, [fetchPcs, navigate, role]);

  // Tick every second to drive the countdown timers.
  useEffect(() => {
    const interval = window.setInterval(() => setTick((x) => x + 1), 1000);
    return () => window.clearInterval(interval);
  }, []);

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

  const now = Date.now() + tick * 0; // tick reference keeps this reactive; Date.now() is always fresh

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
          <button className="admin-nav-item active" type="button">
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
          <button className="admin-nav-item" type="button" onClick={() => navigate("/app/laporan-keuangan-admin")}>
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

        <section className="monitoring-grid" aria-label="Monitoring PC">
          {pcs.map((pc) => {
            // Used = status is "online", full stop.
            // Timer is a separate concern: only show countdown if sessionEndTime
            // is set AND in the future. Online with no timer = Used but show "--".
            const isUsed = pc.status === "online";
            const hasTimer = isUsed && pc.sessionEndTime !== null && pc.sessionEndTime > now;
            const secondsLeft = hasTimer ? Math.floor((pc.sessionEndTime! - now) / 1000) : 0;

            return (
              <article key={pc.id} className="pc-card">
                <div className="pc-card-title">
                  <span className="pc-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none">
                      <rect x="3" y="4" width="18" height="12" rx="2" />
                      <path d="M8 20h8" />
                      <path d="M12 16v4" />
                    </svg>
                  </span>
                  <span className="pc-name">{pc.pcNumber}</span>
                </div>

                <p className={`pc-timer${isUsed ? " pc-timer--used" : ""}`}>
                  {hasTimer ? formatDuration(secondsLeft) : "--"}
                </p>

                <span className={`pc-badge ${isUsed ? "used" : "empty"}`}>
                  {isUsed ? "Terpakai" : "Kosong"}
                </span>
              </article>
            );
          })}
        </section>
      </main>
    </section>
  );
}