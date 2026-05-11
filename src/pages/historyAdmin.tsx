import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./dashboardAdmin.css";
import "./historyAdmin.css";

const BASEURL = import.meta.env.VITE_BASEURL;

type AdminOrderRow = {
  id: number;
  pcId: number | null;
  username: string;
  description: string;
  coins: number;
  createdAt: number;
  displayTime: string;
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

const pad2 = (value: number) => String(Math.max(0, value)).padStart(2, "0");

const formatTime = (timestamp: number) => {
  if (!Number.isFinite(timestamp) || timestamp <= 0) return "-";
  const date = new Date(toDateMs(timestamp));
  return `${pad2(date.getHours())}.${pad2(date.getMinutes())}`;
};

const monthOptions = [
  { value: 0, label: "Jan" },
  { value: 1, label: "Feb" },
  { value: 2, label: "Mar" },
  { value: 3, label: "Apr" },
  { value: 4, label: "Mei" },
  { value: 5, label: "Jun" },
  { value: 6, label: "Jul" },
  { value: 7, label: "Agu" },
  { value: 8, label: "Sep" },
  { value: 9, label: "Okt" },
  { value: 10, label: "Nov" },
  { value: 11, label: "Des" },
];

const getDefaultMonthYear = () => {
  const now = new Date();
  return { month: now.getMonth(), year: now.getFullYear() };
};

const resolvePcId = () => {
  const fromStorage = Number.parseInt(localStorage.getItem("pcId")?.trim() ?? "", 10);
  if (Number.isFinite(fromStorage) && fromStorage > 0) return fromStorage;
  const fromEnv = Number.parseInt((import.meta.env.VITE_PC_ID as string | undefined)?.trim() ?? "", 10);
  if (Number.isFinite(fromEnv) && fromEnv > 0) return fromEnv;
  return null;
};

const extractOrdersList = (payload: unknown): unknown[] => {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];
  const obj = payload as Record<string, unknown>;

  const candidates: unknown[] = [];
  if (Array.isArray(obj.data)) candidates.push(obj.data);
  if (Array.isArray(obj.orders)) candidates.push(obj.orders);
  if (obj.data && typeof obj.data === "object") {
    const dataObj = obj.data as Record<string, unknown>;
    if (Array.isArray(dataObj.orders)) candidates.push(dataObj.orders);
    if (Array.isArray(dataObj.data)) candidates.push(dataObj.data);
  }

  for (const c of candidates) {
    if (Array.isArray(c)) return c;
  }
  return [];
};

export default function HistoryAdmin() {
  const navigate = useNavigate();
  const [{ month, year }, setMonthYear] = useState(getDefaultMonthYear);
  const [orders, setOrders] = useState<AdminOrderRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>("");

  const role = useMemo(() => localStorage.getItem("role")?.toLowerCase() ?? "user", []);
  const tokenFromLogin = useMemo(() => localStorage.getItem("token")?.trim() ?? "", []);
  const secretToken = useMemo(() => (import.meta.env.VITE_ADMIN_SECRET_TOKEN as string | undefined)?.trim() ?? "", []);
  const authToken = useMemo(() => secretToken || tokenFromLogin, [secretToken, tokenFromLogin]);

  const dateRange = useMemo(() => {
    const from = new Date(year, month, 1, 0, 0, 0, 0);
    const to = new Date(year, month + 1, 0, 23, 59, 59, 999);
    return { from, to };
  }, [month, year]);

  const fetchOrders = useCallback(
    async (signal?: AbortSignal) => {
      if (!authToken) {
        setErrorMessage("Token admin belum ada.");
        setOrders([]);
        return;
      }

      setIsLoading(true);
      setErrorMessage("");
      try {
        const endpoint = "/api/logs";
        const base = typeof BASEURL === "string" && BASEURL.trim().length ? BASEURL.trim() : window.location.origin;
        const baseUrl = new URL(endpoint, base);

        const makeUrl = (withRange: boolean) => {
          const next = new URL(baseUrl.toString());
          if (withRange) {
            next.searchParams.set("from", dateRange.from.toISOString());
            next.searchParams.set("to", dateRange.to.toISOString());
          }
          return next;
        };

        const requestOnce = async (withRange: boolean) => {
          const response = await fetch(makeUrl(withRange).toString(), {
            signal,
            headers: { Authorization: `Bearer ${authToken}` },
          });
          if (!response.ok) {
            const detail = `${response.status} ${response.statusText}`.trim();
            throw new Error(detail || "Request failed");
          }
          const payload: unknown = await response.json();
          return extractOrdersList(payload);
        };

        let list: unknown[] = [];
        try {
          list = await requestOnce(true);
        } catch {
          // ignore, fallback below
        }
        if (list.length === 0) {
          // you wheelchair
          list = await requestOnce(false);
        }

        const mapped: AdminOrderRow[] = list
          .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
          .map((item) => {
            const pcId = toNumber(item.pcId) ?? toNumber(item.pc) ?? toNumber(item.pc_id);
            const username =
              toNonEmptyString(item.username) ??
              toNonEmptyString(item.userName) ??
              toNonEmptyString(item.name) ??
              toNonEmptyString(item.customer) ??
              "-";

            const descriptionRaw =
              toNonEmptyString(item.description) ??
              toNonEmptyString(item.type) ??
              toNonEmptyString(item.transactionType) ??
              toNonEmptyString(item.title) ??
              "-";

            const descriptionLines = Array.isArray(item.items)
              ? item.items
                  .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
                  .map((x) => toNonEmptyString(x.name) ?? toNonEmptyString(x.title) ?? "")
                  .filter(Boolean)
              : [];

            const description = descriptionLines.length ? `${descriptionRaw}\n${descriptionLines.join("\n")}` : descriptionRaw;

            const coins =
              toNumber(item.coins) ??
              toNumber(item.coin) ??
              toNumber(item.amountCoin) ??
              toNumber(item.amount) ??
              0;

            const createdAt =
              toNumber(item.createdAt) ??
              toNumber(item.timestamp) ??
              toNumber(item.time) ??
              toNumber(item.created_at) ??
              toNumber(item.createdAtMs) ??
              0;

            const displayTime = toNonEmptyString(item.displayTime) ?? toNonEmptyString(item.displayDate) ?? formatTime(createdAt);

            return {
              id: toNumber(item.id) ?? toNumber(item.orderId) ?? (createdAt ? createdAt : Date.now()),
              pcId,
              username,
              description,
              coins,
              createdAt,
              displayTime,
            };
          })
          .sort((a, b) => b.createdAt - a.createdAt);

        setOrders(mapped);
      } catch (err) {
        if ((err as { name?: string }).name !== "AbortError") {
          const message = toNonEmptyString((err as { message?: unknown }).message);
          setErrorMessage(message ? `Gagal memuat riwayat transaksi (${message}).` : "Gagal memuat riwayat transaksi.");
          setOrders([]);
        }
      } finally {
        setIsLoading(false);
      }
    },
    [authToken, dateRange.from, dateRange.to],
  );

  useEffect(() => {
    if (role !== "admin") {
      navigate("/app/dashboard", { replace: true });
      return;
    }
    const controller = new AbortController();
    fetchOrders(controller.signal);
    return () => controller.abort();
  }, [fetchOrders, navigate, role]);

  const filteredOrders = useMemo(() => {
    const fromMs = dateRange.from.getTime();
    const toMs = dateRange.to.getTime();
    return orders.filter((order) => {
      const createdMs = toDateMs(order.createdAt);
      return createdMs >= fromMs && createdMs <= toMs;
    });
  }, [dateRange.from, dateRange.to, orders]);

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

  const yearOptions = useMemo(() => {
    const current = new Date().getFullYear();
    return Array.from({ length: 7 }, (_, idx) => current - 5 + idx);
  }, []);

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
          <button className="admin-nav-item active" type="button">
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

        <section className="card admin-order-history-card" aria-label="Riwayat Transaksi Admin">
          <div className="admin-order-history-top">
            <h3>Riwayat Transaksi</h3>
            <div className="admin-order-history-filters">
              <label className="sr-only" htmlFor="admin-history-month">
                Bulan
              </label>
              <select
                id="admin-history-month"
                value={month}
                onChange={(e) => setMonthYear((prev) => ({ ...prev, month: Number.parseInt(e.target.value, 10) }))}
              >
                {monthOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>

              <label className="sr-only" htmlFor="admin-history-year">
                Tahun
              </label>
              <select
                id="admin-history-year"
                value={year}
                onChange={(e) => setMonthYear((prev) => ({ ...prev, year: Number.parseInt(e.target.value, 10) }))}
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="admin-history-head">
            <span>PC</span>
            <span>User</span>
            <span>Jenis Transaksi</span>
            <span>Nominal</span>
            <span>Waktu</span>
          </div>

          <div className="admin-history-body admin-order-history-body">
            {isLoading ? (
              <div className="admin-order-history-empty">Memuat riwayat...</div>
            ) : errorMessage ? (
              <div className="admin-order-history-empty">{errorMessage}</div>
            ) : filteredOrders.length === 0 ? (
              <div className="admin-order-history-empty">Belum ada transaksi.</div>
            ) : (
              filteredOrders.map((order) => (
                <div key={order.id} className="admin-history-row">
                  <span>{order.pcId ? `PC ${order.pcId}` : "-"}</span>
                  <span className="admin-order-history-username">{order.username}</span>
                  <span className="admin-order-history-desc">{order.description}</span>
                  <span>{Math.abs(order.coins)} Coin</span>
                  <span>{order.displayTime}</span>
                </div>
              ))
            )}
          </div>
        </section>
      </main>
    </section>
  );
}
