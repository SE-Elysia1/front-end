import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./dashboardAdmin.css";
import "./monitoringAdmin.css";

const BASEURL = import.meta.env.VITE_BASEURL;
const TOTAL_PC = Number.parseInt(import.meta.env.VITE_TOTAL_PC ?? "12", 10);

const toNumber = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
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

type PcStatus = {
  pcId: number;
  endTimeMs: number | null;
};

export default function MonitoringAdmin() {
  const navigate = useNavigate();
  const [pcStatusById, setPcStatusById] = useState<Record<number, PcStatus>>({});
  const [tick, setTick] = useState(0);

  const authToken = useMemo(() => localStorage.getItem("token")?.trim() ?? "", []);
  const role = useMemo(() => localStorage.getItem("role")?.toLowerCase() ?? "user", []);

  const pcIds = useMemo(() => {
    const total = Number.isFinite(TOTAL_PC) && TOTAL_PC > 0 ? TOTAL_PC : 12;
    return Array.from({ length: total }, (_, idx) => idx + 1);
  }, []);

  const fetchPcTimers = useCallback(async () => {
    if (!authToken) return;
    try {
      const response = await fetch(`${BASEURL}/api/pctimer`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (!response.ok) return;
      const payload: unknown = await response.json();

      const rows = Array.isArray(payload)
        ? payload
        : payload && typeof payload === "object" && Array.isArray((payload as Record<string, unknown>).data)
          ? ((payload as Record<string, unknown>).data as unknown[])
          : [];

      const next: Record<number, PcStatus> = {};
      for (const row of rows) {
        if (!row || typeof row !== "object") continue;
        const obj = row as Record<string, unknown>;
        const pcId = toNumber(obj.pcId) ?? toNumber(obj.id) ?? toNumber(obj.pc);
        if (!pcId) continue;

        const endTime =
          toNumber(obj.sessionEndTime) ??
          toNumber(obj.endTime) ??
          toNumber(obj.expiredAt) ??
          toNumber(obj.session_end_time);

        const endTimeMs = endTime !== null ? toDateMs(endTime) : null;

        next[pcId] = { pcId, endTimeMs };
      }

      setPcStatusById(next);
    } catch {
      // ignore
    }
  }, [authToken]);

  useEffect(() => {
    if (role !== "admin") {
      navigate("/app/dashboard", { replace: true });
      return;
    }
    fetchPcTimers();
    const poll = window.setInterval(fetchPcTimers, 15_000);
    return () => window.clearInterval(poll);
  }, [fetchPcTimers, navigate, role]);

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

  const now = Date.now() + tick;

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
          {pcIds.map((pcId) => {
            const status = pcStatusById[pcId];
            const endTimeMs = status?.endTimeMs ?? null;
            const secondsLeft = endTimeMs ? Math.floor((endTimeMs - now) / 1000) : 0;
            const isUsed = endTimeMs ? endTimeMs > now : false;

            return (
              <article key={pcId} className="pc-card">
                <div className="pc-card-title">
                  <span className="pc-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none">
                      <rect x="3" y="4" width="18" height="12" rx="2" />
                      <path d="M8 20h8" />
                      <path d="M12 16v4" />
                    </svg>
                  </span>
                  <span className="pc-name">{`PC ${pcId}`}</span>
                </div>

                <p className="pc-timer">{isUsed ? formatDuration(secondsLeft) : "--"}</p>

                <span className={`pc-badge ${isUsed ? "used" : "empty"}`}>{isUsed ? "Used" : "Kosong"}</span>
              </article>
            );
          })}
        </section>
      </main>
    </section>
  );
}
