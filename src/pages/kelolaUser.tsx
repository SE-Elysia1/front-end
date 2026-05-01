import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./dashboardAdmin.css";
import "./kelolaUser.css";

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

type ManagedUserRow = {
  id: number;
  username: string;
  balanceCoin: number;
};

export default function KelolaUser() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<ManagedUserRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const userId = useMemo(() => localStorage.getItem("userId")?.trim() ?? "", []);
  const authToken = useMemo(() => localStorage.getItem("token")?.trim() ?? "", []);
  const role = useMemo(() => localStorage.getItem("role")?.toLowerCase() ?? "user", []);

  const fetchUsers = useCallback(async () => {
    if (!authToken || !userId) return;
    setIsLoading(true);
    try {
      const response = await fetch(`${BASEURL}/api/admin/user/${userId}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (!response.ok) throw new Error("Gagal ambil data user");
      const payload: unknown = await response.json();

      const list = Array.isArray(payload)
        ? payload
        : payload && typeof payload === "object" && Array.isArray((payload as Record<string, unknown>).data)
          ? ((payload as Record<string, unknown>).data as unknown[])
          : [];

      const mapped: ManagedUserRow[] = list
        .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
        .map((item) => {
          const id = toNumber(item.id) ?? toNumber(item.userId) ?? 0;
          const username =
            toNonEmptyString(item.username) ??
            toNonEmptyString(item.userName) ??
            toNonEmptyString(item.name) ??
            (id ? `User #${id}` : "-");
          const balanceCoin =
            toNumber(item.balanceCoin) ??
            toNumber(item.balance) ??
            toNumber(item.coin) ??
            toNumber(item.coins) ??
            0;
          return { id, username, balanceCoin };
        })
        .sort((a, b) => a.username.localeCompare(b.username, "id"));

      setRows(mapped);
    } finally {
      setIsLoading(false);
    }
  }, [authToken, userId]);

  useEffect(() => {
    if (role !== "admin") {
      navigate("/app/dashboard", { replace: true });
      return;
    }
    fetchUsers();
  }, [fetchUsers, navigate, role]);

  const handleLogout = () => {
    localStorage.clear();
    navigate("/login");
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => row.username.toLowerCase().includes(q));
  }, [query, rows]);

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
          <button className="admin-nav-item active" type="button">
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
          <button className="admin-nav-item" type="button">
            <span className="admin-nav-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M4 12a8 8 0 1 0 2.3-5.7L4 8.6" />
                <path d="M4 4v4.6h4.6" />
                <path d="M12 8v4l3 2" />
              </svg>
            </span>
            Riwayat Transaksi
          </button>
          <button className="admin-nav-item" type="button">
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

        <div className="kelola-user-search">
          <label className="kelola-user-searchbox">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari User"
              aria-label="Cari User"
            />
            <span className="kelola-user-searchicon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-3.5-3.5" />
              </svg>
            </span>
          </label>
        </div>

        <section className="card kelola-user-card">
          <div className="kelola-user-table-head">
            <span>Username</span>
            <span>Saldo Coin</span>
            <span className="kelola-user-aksi">Aksi</span>
          </div>

          <div className="kelola-user-table-body">
            {isLoading ? (
              <div className="kelola-user-empty">Loading...</div>
            ) : filtered.length ? (
              filtered.map((row) => (
                <div key={row.id || row.username} className="kelola-user-table-row">
                  <span className="kelola-user-username">{row.username}</span>
                  <span className="kelola-user-balance">{row.balanceCoin} Coin</span>
                  <span className="kelola-user-aksi">
                    <button type="button" className="kelola-user-iconbtn" aria-label="Edit" disabled>
                      <svg viewBox="0 0 24 24" fill="none">
                        <path d="M12 20h9" />
                        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" />
                      </svg>
                    </button>
                    <button type="button" className="kelola-user-iconbtn" aria-label="Delete" disabled>
                      <svg viewBox="0 0 24 24" fill="none">
                        <path d="M3 6h18" />
                        <path d="M8 6V4h8v2" />
                        <path d="M6 6l1 16h10l1-16" />
                        <path d="M10 11v6" />
                        <path d="M14 11v6" />
                      </svg>
                    </button>
                  </span>
                </div>
              ))
            ) : (
              <div className="kelola-user-empty">Tidak ada user</div>
            )}
          </div>
        </section>
      </main>
    </section>
  );
}

