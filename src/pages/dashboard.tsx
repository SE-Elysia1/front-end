import { useCallback, useEffect, useState } from "react";
import "./dashboard.css";

type LogEntry = {
  id: number;
  userId: number;
  type: string;
  coins: number;
  incomeIdr: number | null;
  description: string;
  pcId: number | null;
  createdAt: number;
  displayDate: string;
};
type FoodItem = {
  id: number;
  name: string;
  price: number;
};

type PlayPlan = {
  id: number;
  label: string;
  durationSeconds: number;
  priceCoin: number;
};

const BASEURL = import.meta.env.VITE_BASEURL;

const getInitialCoin = () => {
  const saved = localStorage.getItem("coin");
  const parsed = saved ? Number(saved) : 0;
  return Number.isFinite(parsed) ? parsed : 0;
};

const toNumber = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const normalized = value.trim().replace(",", ".");
    const parsed = Number(normalized);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

const getString = (value: unknown) => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }
  return null;
};

const normalizeMenus = (payload: unknown): FoodItem[] => {
  type PayloadShape = { data?: unknown[]; menus?: unknown[] };
  const p = payload as PayloadShape;
  const maybeArray = Array.isArray(payload)
    ? payload
    : p?.data || p?.menus || [];
  const items: FoodItem[] = [];
  for (const raw of maybeArray) {
    if (!raw || typeof raw !== "object") continue;
    const obj = raw as Record<string, unknown>;
    const id = toNumber(obj.id) ?? toNumber(obj.foodId) ?? 0;
    const name =
      getString(obj.name) ?? getString(obj.menu_name) ?? getString(obj.nama);
    const price =
      toNumber(obj.price) ?? toNumber(obj.coin) ?? toNumber(obj.harga);
    if (!name || price === null) continue;
    items.push({ id, name, price });
  }
  return items;
};

const normalizePlans = (payload: unknown): PlayPlan[] => {
  type PayloadShape = { data?: unknown[]; plans?: unknown[] };
  const p = payload as PayloadShape;
  const maybeArray = Array.isArray(payload)
    ? payload
    : p?.data || p?.plans || [];
  const items: PlayPlan[] = [];
  for (const raw of maybeArray) {
    if (!raw || typeof raw !== "object") continue;
    const obj = raw as Record<string, unknown>;
    const id = toNumber(obj.id) ?? toNumber(obj.planId) ?? 0;
    const label = getString(obj.name) ?? getString(obj.label) ?? "Paket";
    const hours = toNumber(obj.hours) ?? 0;
    const minutes = toNumber(obj.minutes) ?? 0;
    const durationSeconds = hours > 0 ? hours * 3600 : minutes * 60;
    const priceCoin = toNumber(obj.price) ?? toNumber(obj.coin) ?? 0;
    items.push({ id, label, durationSeconds, priceCoin });
  }
  return items;
};

const formatDuration = (seconds: number) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return h > 0
    ? `${h}h ${m}m ${s.toString().padStart(2, "0")}s`
    : `${m}m ${s.toString().padStart(2, "0")}s`;
};
const getLogIcon = (type: string) => {
  switch (type) {
    case "topup":
      return "💲";
    case "billing":
      return "🖥️";
    case "order":
      return "🍔";
    case "food":
      return "🍔";
    default:
      return "📋";
  }
};

const getLogColor = (coins: number) => {
  return coins >= 0 ? "log-positive" : "log-negative";
};
export default function Dashboard() {
  const [foodMenu, setFoodMenu] = useState<FoodItem[]>([]);
  const [plans, setPlans] = useState<PlayPlan[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isMenuLoading, setIsMenuLoading] = useState(false);
  const [isPlanLoading, setIsPlanLoading] = useState(false);
  const [isBalanceLoading, setIsBalanceLoading] = useState(false);
  const [isLogsLoading, setIsLogsLoading] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [coin, setCoin] = useState(getInitialCoin());
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isPlanOpen, setIsPlanOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [planQuantities, setPlanQuantities] = useState<Record<number, number>>(
    {},
  );

  const [user] = useState({
    userId: localStorage.getItem("userId"),
    username: localStorage.getItem("username"),
    pcId: localStorage.getItem("pcId"),
  });

  const fetchTimer = useCallback(async () => {
    if (!user.pcId) return;
    try {
      const response = await fetch(`${BASEURL}/api/pcs/${user.pcId}/timer`);
      if (!response.ok) throw new Error();
      const data = await response.json();
      if (data.success && data.status === "online" && data.sessionEndTime) {
        const secondsLeft = Math.floor(
          (data.sessionEndTime - Date.now()) / 1000,
        );
        if (secondsLeft > 0) {
          setTimeLeft(secondsLeft);
          setPlaying(true);
        } else {
          setTimeLeft(0);
          setPlaying(false);
        }
      } else {
        setTimeLeft(0);
        setPlaying(false);
      }
    } catch {
      console.error("Gagal mengambil timer.");
    }
  }, [user.pcId]);

  const fetchUserBalance = useCallback(async () => {
    if (!user.userId) return;
    setIsBalanceLoading(true);
    try {
      const response = await fetch(`${BASEURL}/api/user/${user.userId}`);
      if (!response.ok) throw new Error();

      const result = await response.json(); 
      const serverCoin = result.data?.balance ?? coin;

      setCoin(serverCoin);
      localStorage.setItem("coin", String(serverCoin));
    } catch {
      console.error("Gagal sinkronisasi koin.");
    } finally {
      setIsBalanceLoading(false);
    }
  }, [user.userId, coin]);

  const fetchMenus = useCallback(async (signal?: AbortSignal) => {
    setIsMenuLoading(true);
    try {
      const response = await fetch(`${BASEURL}/api/menus`, { signal });
      const payload = await response.json();
      setFoodMenu(normalizeMenus(payload));
    } catch (e) {
      console.error(e);
    } finally {
      setIsMenuLoading(false);
    }
  }, []);

  const fetchPlans = useCallback(async (signal?: AbortSignal) => {
    setIsPlanLoading(true);
    try {
      const response = await fetch(`${BASEURL}/api/plans`, { signal });
      const payload = await response.json();
      setPlans(normalizePlans(payload));
    } catch (e) {
      console.error(e);
    } finally {
      setIsPlanLoading(false);
    }
  }, []);

  const fetchLogs = useCallback(
    async (signal?: AbortSignal) => {
      if (!user.userId) return;
      setIsLogsLoading(true);
      try {
        const response = await fetch(
          `${BASEURL}/api/logs?requestingUserId=${user.userId}`,
          { signal },
        );
        if (!response.ok) throw new Error();
        const data: LogEntry[] = await response.json();
        const userId = parseInt(user.userId, 10);
        const userLogs = data
          .filter((log) => log.userId === userId)
          .sort((a, b) => b.createdAt - a.createdAt);
        setLogs(userLogs);
      } catch (e) {
        console.error("Gagal memuat history.", e);
      } finally {
        setIsLogsLoading(false);
      }
    },
    [user.userId],
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchMenus(controller.signal);
    fetchPlans(controller.signal);
    fetchUserBalance();
    fetchTimer();
    fetchLogs(controller.signal);
    return () => controller.abort();
  }, [fetchMenus, fetchPlans, fetchUserBalance, fetchTimer, fetchLogs]);

  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev <= 1 ? (setPlaying(false), 0) : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [playing]);

  const handleSubmitOrder = async () => {
    const selectedItems = foodMenu.filter(
      (item) => (quantities[item.name] ?? 0) > 0,
    );
    const totalCost = selectedItems.reduce(
      (sum, item) => sum + item.price * (quantities[item.name] ?? 0),
      0,
    );

    if (selectedItems.length === 0) return alert("Pilih minimal 1 menu.");
    if (coin < totalCost) return alert("Coin tidak cukup.");

    const cart = selectedItems.map((item) => ({
      foodId: item.id,
      qty: quantities[item.name],
    }));

    const payload = {
      userId: parseInt(user.userId || "0"),
      pcId: parseInt(user.pcId || "0"),
      cart,
    };

    try {
      const response = await fetch(`${BASEURL}/api/order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        await fetchUserBalance();
        await fetchLogs();
        setQuantities({});
        setIsMenuOpen(false);
      } else {
        alert("Gagal memesan.");
      }
    } catch {
      alert("Network error.");
    }
  };

  const handleSubmitPlan = async () => {
    const selectedPlans = plans.filter((p) => (planQuantities[p.id] ?? 0) > 0);
    const totalCost = selectedPlans.reduce(
      (sum, p) => sum + p.priceCoin * planQuantities[p.id],
      0,
    );

    if (selectedPlans.length === 0) return alert("Pilih paket dulu!");
    if (coin < totalCost) return alert("Coin kurang!");

    const payload = {
      userId: parseInt(user.userId || "0"),
      pcId: parseInt(user.pcId || "0"),
      plans: selectedPlans.map((p) => ({
        planId: p.id,
        qty: planQuantities[p.id],
      })),
    };

    try {
      const response = await fetch(`${BASEURL}/api/session/buy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        await fetchUserBalance();
        await fetchTimer();
        await fetchLogs();
        setPlanQuantities({});
        setIsPlanOpen(false);
      } else {
        alert("Gagal membeli paket.");
      }
    } catch {
      alert("Network error.");
    }
  };

  const handleLogoutClick = () => {
    if (playing && timeLeft > 0) {
      setShowLogoutConfirm(true);
    } else {
      handleLogout();
    }
  };

  const handleLogout = async () => {
    setShowLogoutConfirm(false);
    if (!user.pcId) {
      localStorage.clear();
      window.location.href = "/login";
      return;
    }
    try {
      const response = await fetch(`${BASEURL}/api/logout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pcId: parseInt(user.pcId, 10) }),
      });
      if (response.ok) {
        localStorage.clear();
        window.location.href = "/login";
      } else {
        alert("Logout gagal.");
      }
    } catch {
      alert("Tidak dapat terhubung ke server.");
    }
  };

  const recentLogs = logs.slice(0, 5);

  return (
    <section className="page dashboard-page">
      <header className="dashboard-header">
        <h2 className="page-title">Halo, {user.username}!</h2>
        <button className="btn logout-btn" onClick={handleLogoutClick}>
          Log Out
        </button>
      </header>

      <div className="dashboard-grid">
        <article className="card coin-card">
          <p>Total Coin</p>
          <h3>{isBalanceLoading ? "..." : `${coin} Coin`}</h3>
        </article>

        <article className="card status-card">
          <h3>Status</h3>
          <p>PC #{user.pcId}</p>
          <p>{playing ? `Sisa: ${formatDuration(timeLeft)}` : "Off"}</p>
        </article>

        <article className="card action-card">
          <h3>Paket</h3>
          <button className="btn" onClick={() => setIsPlanOpen(true)}>
            Beli Durasi
          </button>
        </article>

        <article className="card action-card">
          <h3>Menu</h3>
          <button className="btn" onClick={() => setIsMenuOpen(true)}>
            Pesan Makan
          </button>
        </article>

        <article className="card history-card">
          <div className="history-card-header">
            <h3>History</h3>
            {logs.length > 5 && (
              <button
                className="btn-link"
                onClick={() => setIsHistoryOpen(true)}
              >
                Lihat Semua
              </button>
            )}
          </div>
          {isLogsLoading ? (
            <p className="history-empty">Memuat history...</p>
          ) : recentLogs.length === 0 ? (
            <p className="history-empty">Belum ada transaksi.</p>
          ) : (
            <ul className="history-list">
              {recentLogs.map((log) => (
                <li key={log.id} className="history-item">
                  <span className="history-icon">{getLogIcon(log.type)}</span>
                  <div className="history-info">
                    <span className="history-desc">{log.description}</span>
                    <span className="history-date">{log.displayDate}</span>
                  </div>
                  <span className={`history-coins ${getLogColor(log.coins)}`}>
                    {log.coins >= 0 ? `+${log.coins}` : log.coins}c
                  </span>
                </li>
              ))}
            </ul>
          )}
        </article>
      </div>

      {/* History Modal */}
      {isHistoryOpen && (
        <div
          className="menu-modal-overlay"
          onClick={() => setIsHistoryOpen(false)}
        >
          <div className="menu-modal card" onClick={(e) => e.stopPropagation()}>
            <div className="menu-modal-header">
              <h3>Riwayat Transaksi</h3>
            </div>
            <div className="menu-list">
              {isLogsLoading ? (
                <p className="modal-status">Memuat...</p>
              ) : logs.length === 0 ? (
                <p className="modal-status">Belum ada transaksi.</p>
              ) : (
                logs.map((log) => (
                  <div key={log.id} className="history-modal-item">
                    <span className="history-icon">{getLogIcon(log.type)}</span>
                    <div className="history-info">
                      <span className="history-desc">{log.description}</span>
                      <span className="history-date">{log.displayDate}</span>
                    </div>
                    <span className={`history-coins ${getLogColor(log.coins)}`}>
                      {log.coins >= 0 ? `+${log.coins}` : log.coins}c
                    </span>
                  </div>
                ))
              )}
            </div>
            <div className="menu-modal-footer">
              <button className="btn" onClick={() => setIsHistoryOpen(false)}>
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Plan Modal */}
      {isPlanOpen && (
        <div
          className="menu-modal-overlay"
          onClick={() => setIsPlanOpen(false)}
        >
          <div className="menu-modal card" onClick={(e) => e.stopPropagation()}>
            <div className="menu-modal-header">
              <h3>List Paket</h3>
            </div>
            <div className="menu-list">
              {isPlanLoading && <p className="modal-status">Memuat paket...</p>}
              {!isPlanLoading &&
                plans.map((p) => (
                  <div key={p.id} className="plan-item-row">
                    <div className="menu-item-info">
                      <p>{p.label}</p>
                      <span>{p.priceCoin}🪙</span>
                    </div>
                    <div className="qty-control">
                      <button
                        className="btn secondary"
                        onClick={() =>
                          setPlanQuantities((v) => ({
                            ...v,
                            [p.id]: Math.max(0, (v[p.id] ?? 0) - 1),
                          }))
                        }
                      >
                        -
                      </button>
                      <span>{planQuantities[p.id] ?? 0}</span>
                      <button
                        className="btn secondary"
                        onClick={() =>
                          setPlanQuantities((v) => ({
                            ...v,
                            [p.id]: (v[p.id] ?? 0) + 1,
                          }))
                        }
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
            </div>
            <div className="menu-modal-footer">
              <button className="btn" onClick={handleSubmitPlan}>
                Checkout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Food Modal */}
      {isMenuOpen && (
        <div
          className="menu-modal-overlay"
          onClick={() => setIsMenuOpen(false)}
        >
          <div className="menu-modal card" onClick={(e) => e.stopPropagation()}>
            <div className="menu-modal-header">
              <h3>Menu Makanan</h3>
            </div>
            <div className="menu-list">
              {isMenuLoading && <p className="modal-status">Memuat menu...</p>}
              {!isMenuLoading &&
                foodMenu.map((item) => (
                  <div key={item.name} className="menu-item-row">
                    <div className="menu-item-info">
                      <p>{item.name}</p>
                      <span>{item.price}🪙</span>
                    </div>
                    <div className="qty-control">
                      <button
                        className="btn secondary"
                        onClick={() =>
                          setQuantities((v) => ({
                            ...v,
                            [item.name]: Math.max(0, (v[item.name] ?? 0) - 1),
                          }))
                        }
                      >
                        -
                      </button>
                      <span>{quantities[item.name] ?? 0}</span>
                      <button
                        className="btn secondary"
                        onClick={() =>
                          setQuantities((v) => ({
                            ...v,
                            [item.name]: (v[item.name] ?? 0) + 1,
                          }))
                        }
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
            </div>
            <div className="menu-modal-footer">
              <button className="btn" onClick={handleSubmitOrder}>
                Pesan
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Logout Confirm Modal */}
      {showLogoutConfirm && (
        <div
          className="confirm-overlay"
          onClick={() => setShowLogoutConfirm(false)}
        >
          <div
            className="confirm-modal card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="confirm-icon">⚠️</div>
            <h3 className="confirm-title">Yakin mau logout?</h3>
            <p className="confirm-body">
              Anda masih memiliki sisa waktu bermain.
              <br />
              <span className="confirm-warning">
                Logout akan menghanguskan waktu anda.
              </span>
            </p>
            <div className="confirm-actions">
              <button
                className="btn secondary"
                onClick={() => setShowLogoutConfirm(false)}
              >
                Batal
              </button>
              <button className="btn danger" onClick={handleLogout}>
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
