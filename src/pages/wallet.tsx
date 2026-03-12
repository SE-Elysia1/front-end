import { useEffect, useMemo, useState } from "react"
import "./wallet.css"

type PaymentMethod = "cash" | "bank"
const BASEURL = import.meta.env.VITE_BASEURL
const toPositiveInt = (value: string) => {
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return null
  return parsed
}

const toNumber = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string") {
    const parsed = Number(value.trim())
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

const getCoinFromResponse = (payload: unknown) => {
  if (!payload || typeof payload !== "object") return null
  const obj = payload as Record<string, unknown>

  const direct =
    toNumber(obj.coin) ??
    toNumber(obj.totalCoin) ??
    toNumber(obj.balance) ??
    toNumber(obj.total) ??
    toNumber(obj.amount)
  if (direct !== null) return direct

  const data = obj.data
  if (data && typeof data === "object") {
    const dataObj = data as Record<string, unknown>
    const nested =
      toNumber(dataObj.coin) ??
      toNumber(dataObj.totalCoin) ??
      toNumber(dataObj.balance) ??
      toNumber(dataObj.total) ??
      toNumber(dataObj.amount)
    if (nested !== null) return nested
  }

  return null
}

export default function Wallet() {
  const [coin, setCoin] = useState(() => {
    const saved = localStorage.getItem("coin")
    const parsed = saved ? Number(saved) : 0
    return Number.isFinite(parsed) ? parsed : 0
  })
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash")
  const [topupAmount, setTopupAmount] = useState("1")
  const [isTopupLoading, setIsTopupLoading] = useState(false)
  const [topupError, setTopupError] = useState<string | null>(null)

  const userId = useMemo(() => {
    const raw = localStorage.getItem("userId")
    if (!raw) return null
    const parsed = Number.parseInt(raw, 10)
    return Number.isFinite(parsed) ? parsed : null
  }, [])

  useEffect(() => {
    localStorage.setItem("coin", String(coin))
  }, [coin])

  const topUp = async () => {
    setTopupError(null)

    if (!userId) {
      setTopupError("User ID belum ada. Coba login ulang dulu ya.")
      return
    }

    const amount = toPositiveInt(topupAmount)
    if (!amount) {
      setTopupError("Jumlah top up harus angka > 0.")
      return
    }

    setIsTopupLoading(true)

    try {
      const response = await fetch(`${BASEURL}api/user/topup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId,
          amount,
          paymentMethod,
        }),
      })

      const payload: unknown = await response.json().catch(() => null)

      if (!response.ok) {
        const message =
          payload && typeof payload === "object" && payload !== null && "message" in payload
            ? String((payload as { message?: unknown }).message ?? "")
            : ""
        throw new Error(message || `Top up gagal (${response.status})`)
      }

      const nextCoin = getCoinFromResponse(payload)
      setCoin((prev) => (nextCoin !== null ? nextCoin : prev + amount))
    } catch (error) {
      console.error("Top up error:", error)
      setTopupError(error instanceof Error ? error.message : "Top up gagal. Coba lagi ya.")
    } finally {
      setIsTopupLoading(false)
    }
  }

  return (
    <section className="page wallet-page">
      <header className="page-header">
        <h2 className="page-title">Saldo Coin</h2>
        <p className="page-subtitle">Kelola saldo untuk bermain dan pembelian menu</p>
      </header>

      <div className="card wallet-card">
        <p className="wallet-label">Total Coin</p>
        <h3 className="wallet-amount">{coin} Coin</h3>

        <label className="wallet-label" htmlFor="topup-amount">
          Jumlah top up (coin)
        </label>
        <input
          id="topup-amount"
          type="number"
          inputMode="numeric"
          min={1}
          step={1}
          value={topupAmount}
          onChange={(event) => setTopupAmount(event.target.value)}
        />

        {topupError ? <p className="wallet-error">{topupError}</p> : null}

        <button className="btn" onClick={topUp} disabled={isTopupLoading}>
          {isTopupLoading ? "Memproses..." : "Top Up"}
        </button>
      </div>

      <div className="card payment-card">
        <h3 className="payment-title">Metode Pembayaran</h3>

        <button
          type="button"
          className={`payment-option ${paymentMethod === "cash" ? "selected" : ""}`}
          onClick={() => setPaymentMethod("cash")}
        >
          <span className="payment-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <rect x="5" y="4" width="12" height="16" rx="2" />
              <path d="M9 8h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2Z" />
            </svg>
          </span>
          <span>
            <span className="payment-name">Tunai</span>
            <span className="payment-detail">Bayar langsung ke kasir</span>
          </span>
        </button>

        <button
          type="button"
          className={`payment-option ${paymentMethod === "bank" ? "selected" : ""}`}
          onClick={() => setPaymentMethod("bank")}
        >
          <span className="payment-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <rect x="4" y="6" width="16" height="12" rx="2" />
              <path d="M4 10h16" />
            </svg>
          </span>
          <span>
            <span className="payment-name">Transfer Bank</span>
            <span className="payment-detail">BCA / Mandiri / BRI</span>
          </span>
        </button>
      </div>
    </section>
  )
}
