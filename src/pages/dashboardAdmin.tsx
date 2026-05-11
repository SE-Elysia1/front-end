import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./dashboardAdmin.css";

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

type PcEntry = {
  id: number;
  pcNumber: string;
  status: string;
  currentUserId: number | null;
  sessionEndTime: number | null;
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

const resolvePcId = () => {
  const fromStorage = Number.parseInt(localStorage.getItem("pcId")?.trim() ?? "", 10);
  if (Number.isFinite(fromStorage) && fromStorage > 0) return fromStorage;
  const fromEnv = Number.parseInt((import.meta.env.VITE_PC_ID as string | undefined)?.trim() ?? "", 10);
  if (Number.isFinite(fromEnv) && fromEnv > 0) return fromEnv;
  return null;
};

const isToday = (timestamp: number) => {
  const now = new Date();
  const date = new Date(toDateMs(timestamp));
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
};

export default function DashboardAdmin() {
  const navigate = useNavigate();
  const [logs, setLogs] = useState<AdminLogEntry[]>([]);
  const [usernameByUserId, setUsernameByUserId] = useState<Record<number, string>>({});
  const [activeUsersCount, setActiveUsersCount] = useState(0);
  const [usedPcCount, setUsedPcCount] = useState(0);
  const [totalPcCount, setTotalPcCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

 
  const [userId] = useState(() => localStorage.getItem("userId"));
  const [localUsername] = useState(() => localStorage.getItem("username")?.trim() ?? "");
  const [authToken] = useState(() => localStorage.getItem("token")?.trim() ?? "");
  const [role] = useState(() => localStorage.getItem("role")?.toLowerCase() ?? "user");

 
  const fetchingUserIds = useRef<Set<number>>(new Set());

  const todayIncome = useMemo(() => {
    const todayTopups = logs.filter((log) => log.type === "topup" && log.coins > 0 && isToday(log.createdAt));
    const totalCoin = todayTopups.reduce((sum, log) => sum + log.coins, 0);
    return totalCoin * COIN_TO_IDR;
  }, [logs]);

  const todayLogs = useMemo(
    () => logs.filter((log) => isToday(log.createdAt)),
    [logs],
  );

  const recentLogs = useMemo(() => todayLogs.slice(0, 8), [todayLogs]);

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

  const fetchPcs = useCallback(async () => {
    if (!authToken) return;
    try {
      const response = await fetch(`${BASEURL}/api/pcs`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (!response.ok) return;
      const payload: unknown = await response.json();
      // API returns { success: true, data: [...] } — unwrap the envelope.
      // Fall back to treating the payload itself as an array for bare responses.
      const rawRows =
        payload &&
        typeof payload === "object" &&
        Array.isArray((payload as Record<string, unknown>).data)
          ? (payload as Record<string, unknown>).data
          : payload;
      const rows: unknown[] = Array.isArray(rawRows) ? rawRows : [];

      const pcs: PcEntry[] = rows
        .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
        .map((item) => ({
          id: toNumber(item.id) ?? 0,
          pcNumber: toNonEmptyString(item.pcNumber) ?? "-",
          status: toNonEmptyString(item.status) ?? "offline",
          currentUserId: toNumber(item.currentUserId),
          sessionEndTime: toNumber(item.sessionEndTime),
        }));

      const activeCount = pcs.filter((pc) => pc.status === "online").length;

      setTotalPcCount(pcs.length);
      setUsedPcCount(activeCount);
      setActiveUsersCount(activeCount);
    } catch {
      // Network failure — leave previous values in place rather than
      // resetting to 0, which would show misleading zeros to the admin.
    }
  }, [authToken]);


  const fetchMissingUsernames = useCallback(async () => {
    if (!authToken) return;

    const ids = Array.from(new Set(logs.map((log) => log.userId)))
      .filter((id) => id > 0)
      .filter((id) => {
        // Skip if already in-flight.
        if (fetchingUserIds.current.has(id)) return false;
        // Skip if the log entry itself already carries a username.
        const hasInlineUsername = logs.some(
          (log) => log.userId === id && toNonEmptyString(log.username),
        );
        return !hasInlineUsername;
      });

    if (!ids.length) return;

    // Mark all as in-flight before any await.
    for (const id of ids) fetchingUserIds.current.add(id);

    const entries = await Promise.all(
      ids.map(async (id) => {
        try {
          const response = await fetch(`${BASEURL}/api/user/${id}`, {
            headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
          });
          if (!response.ok) return null;
          const payload: unknown = await response.json();
          if (!payload || typeof payload !== "object") return null;
          const root = payload as Record<string, unknown>;
          const rootName =
            toNonEmptyString(root.username) ??
            toNonEmptyString(root.userName) ??
            toNonEmptyString(root.name);
          if (rootName) return [id, rootName] as const;
          const data = root.data;
          if (!data || typeof data !== "object") return null;
          const dataObj = data as Record<string, unknown>;
          const nestedName =
            toNonEmptyString(dataObj.username) ??
            toNonEmptyString(dataObj.userName) ??
            toNonEmptyString(dataObj.name);
          if (!nestedName) return null;
          return [id, nestedName] as const;
        } catch {
          return null;
        }
      }),
    );

    const valid = entries.filter((entry): entry is readonly [number, string] => !!entry);
    if (!valid.length) return;

    // Functional updater: no need for usernameByUserId in deps.
    setUsernameByUserId((prev) => {
      const next = { ...prev };
      for (const [id, username] of valid) next[id] = username;
      return next;
    });
  }, [authToken, logs]);
  // Deps: authToken stable (useState initializer). logs changes only when
  // fetchLogs resolves. Neither dep causes a loop.

  useEffect(() => {
    if (role !== "admin") {
      navigate("/app/dashboard", { replace: true });
      return;
    }

    const load = async () => {
      setIsLoading(true);
      try {
        await Promise.all([fetchLogs(), fetchPcs()]);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [fetchLogs, fetchPcs, navigate, role]);

  useEffect(() => {
    fetchMissingUsernames();
  }, [fetchMissingUsernames]);

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

  return (
    <section className="admin-dashboard-page">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <span className="admin-brand-icon" aria-hidden="true">BW</span>
          <div>
            <p className="admin-brand-title">Billing Warnet</p>
            <p className="admin-brand-subtitle">Sistem Billing Digital</p>
          </div>
        </div>
        <nav className="admin-nav">
          <button className="admin-nav-item active" type="button" onClick={() => navigate("/app/dashboard-admin")}>
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
          <button type="button" className="btn admin-logout-btn" onClick={handleLogout}>Log Out</button>
        </header>

        <article className="card admin-income-card">
          <p>Total Pendapatan</p>
          <h3>{isLoading ? "..." : formatRupiah(todayIncome)}</h3>
        </article>

        <div className="admin-stats-grid">
          <article className="card admin-mini-card">
            <p>User Aktif</p>
            <h4>{isLoading ? "..." : `${activeUsersCount} Orang`}</h4>
          </article>
          <article className="card admin-mini-card">
            <p>PC Terpakai</p>
            <h4>{isLoading ? "..." : `${usedPcCount} / ${totalPcCount}`}</h4>
          </article>
        </div>

        <section className="card admin-history-card">
          <h3>Riwayat Transaksi</h3>
          <div className="admin-history-head">
            <span>PC</span>
            <span>User</span>
            <span>Jenis Transaksi</span>
            <span>Nominal</span>
            <span>Waktu</span>
          </div>
          <div className="admin-history-body">
            {recentLogs.map((log) => (
              <div key={log.id} className="admin-history-row">
                <span>{log.pcId ?? "-"}</span>
                <span>{displayUsername(log)}</span>
                <span>{log.type}</span>
                <span>{Math.abs(log.coins)} Coin</span>
                <span>{log.displayDate}</span>
              </div>
            ))}
          </div>
        </section>
      </main>
    </section>
  );
}