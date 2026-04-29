import { useCallback, useEffect, useMemo, useState } from "react";
import "./history.css";

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

const BASEURL = import.meta.env.VITE_BASEURL;

const toDateMs = (value: number) => (value < 1_000_000_000_000 ? value * 1000 : value);

const getLogIcon = (type: string) => {
  switch (type) {
    case "topup":
      return "💰";
    case "billing":
      return "🖥️";
    case "order":
    case "food":
      return "🍔";
    default:
      return "📋";
  }
};

const getLogColor = (coins: number) => {
  return coins >= 0 ? "log-positive" : "log-negative";
};

export default function History() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  const userId = localStorage.getItem("userId");
  const authToken = useMemo(() => {
    const fromStorage = localStorage.getItem("token")?.trim();
    return fromStorage ? fromStorage : null;
  }, []);

  const fetchLogs = useCallback(
    async (signal?: AbortSignal) => {
      if (!userId) return;
      setIsLoading(true);
      try {
        if (!authToken) throw new Error("Token login belum ada.");
        const response = await fetch(
          `${BASEURL}/api/logs?requestingUserId=${userId}`,
          {
            signal,
            headers: {
              Authorization: `Bearer ${authToken}`,
            },
          },
        );
        if (!response.ok) throw new Error();
        const data: LogEntry[] = await response.json();
        const parsed = parseInt(userId, 10);
        const userLogs = data
          .filter((log) => log.userId === parsed)
          .sort((a, b) => b.createdAt - a.createdAt);
        setLogs(userLogs);
      } catch (e) {
        console.error("Gagal memuat history.", e);
      } finally {
        setIsLoading(false);
      }
    },
    [userId, authToken],
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchLogs(controller.signal);
    return () => controller.abort();
  }, [fetchLogs]);

  const filteredLogs = useMemo(() => {
    const startMs = startDate ? new Date(`${startDate}T00:00:00`).getTime() : null;
    const endMs = endDate ? new Date(`${endDate}T23:59:59.999`).getTime() : null;

    return logs.filter((log) => {
      const createdMs = toDateMs(log.createdAt);
      if (startMs !== null && createdMs < startMs) return false;
      if (endMs !== null && createdMs > endMs) return false;
      return true;
    });
  }, [logs, startDate, endDate]);

  const totalTopupCoin = useMemo(() => {
    return filteredLogs.reduce((sum, log) => (log.coins > 0 ? sum + log.coins : sum), 0);
  }, [filteredLogs]);

  return (
    <section className="page history-page">
      <header className="page-header">
        <h2 className="page-title">Riwayat Transaksi</h2>
        <p className="page-subtitle">
          Semua transaksi top up dan penggunaan saldo
        </p>
      </header>

      <div className="history-filters">
        <label className="history-date-field">
          <span className="sr-only">Tanggal Mulai</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            aria-label="Tanggal Mulai"
          />
        </label>
        <span className="history-date-sep" aria-hidden="true">
          —
        </span>
        <label className="history-date-field">
          <span className="sr-only">Tanggal Akhir</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            aria-label="Tanggal Akhir"
          />
        </label>
      </div>

      <div className="history-summary">
        <p className="history-summary-label">Total Nominal Transaksi</p>
        <p className="history-summary-value">{totalTopupCoin} Coin</p>
      </div>

      <div className="card history-table-card">
        {isLoading ? (
          <p className="history-empty">Memuat riwayat...</p>
        ) : filteredLogs.length === 0 ? (
          <p className="history-empty">Belum ada transaksi.</p>
        ) : (
          <div className="history-table-wrap">
            <table className="history-table">
              <thead>
                <tr>
                  <th scope="col">PC</th>
                  <th scope="col">Jenis Transaksi</th>
                  <th scope="col">Nominal</th>
                  <th scope="col">Waktu</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => (
                  <tr key={log.id}>
                    <td className="col-pc">{log.pcId ? `PC ${log.pcId}` : "-"}</td>
                    <td className="col-type">
                      <span className="history-type-icon" aria-hidden="true">
                        {getLogIcon(log.type)}
                      </span>
                      <span className="history-type-text">{log.description}</span>
                    </td>
                    <td className={`col-amount ${getLogColor(log.coins)}`}>
                      {Math.abs(log.coins)} Coin
                    </td>
                    <td className="col-time">{log.displayDate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
