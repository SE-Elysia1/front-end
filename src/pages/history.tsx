import { useCallback, useEffect, useState } from "react";
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

  const userId = localStorage.getItem("userId");

  const fetchLogs = useCallback(
    async (signal?: AbortSignal) => {
      if (!userId) return;
      setIsLoading(true);
      try {
        const response = await fetch(
          `${BASEURL}/api/logs?requestingUserId=${userId}`,
          { signal },
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
    [userId],
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchLogs(controller.signal);
    return () => controller.abort();
  }, [fetchLogs]);

  return (
    <section className="page history-page">
      <header className="page-header">
        <h2 className="page-title">Riwayat Transaksi</h2>
        <p className="page-subtitle">
          Semua transaksi top up dan penggunaan saldo
        </p>
      </header>

      <div className="card">
        {isLoading ? (
          <p className="history-empty">Memuat riwayat...</p>
        ) : logs.length === 0 ? (
          <p className="history-empty">Belum ada transaksi.</p>
        ) : (
          <ul className="history-list">
            {logs.map((log) => (
              <li key={log.id} className="history-item">
                <span className="history-icon">{getLogIcon(log.type)}</span>
                <div className="history-info">
                  <span className="history-desc">{log.description}</span>
                  <span className="history-date">{log.displayDate}</span>
                </div>
                <div className="history-amounts">
                  <span className={`history-coins ${getLogColor(log.coins)}`}>
                    {log.coins >= 0 ? `+${log.coins}` : log.coins}c
                  </span>
                  {log.incomeIdr !== null && (
                    <span className="history-idr">
                      Rp {log.incomeIdr.toLocaleString("id-ID")}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
