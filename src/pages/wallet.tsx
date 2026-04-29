import { useEffect, useMemo, useState } from "react"
import "./wallet.css"
import qrCodeRickroll from "../assets/qrcode_rickroll.png"

const BASEURL = import.meta.env.VITE_BASEURL
const PHYSICAL_PC_ID = import.meta.env.VITE_PC_ID

type PaymentMethod = "bank"
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
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("bank")
  const [topupAmount, setTopupAmount] = useState("1")
  const [isTopupLoading, setIsTopupLoading] = useState(false)
  const [topupError, setTopupError] = useState<string | null>(null)
  const [isQrOpen, setIsQrOpen] = useState(false)
  const [pendingTopupAmount, setPendingTopupAmount] = useState<number | null>(null)

  const userId = useMemo(() => {
    const raw = localStorage.getItem("userId")
    if (!raw) return null
    const parsed = Number.parseInt(raw, 10)
    return Number.isFinite(parsed) ? parsed : null
  }, [])

  const authToken = useMemo(() => {
    const fromStorage = localStorage.getItem("token")?.trim()
    return fromStorage ? fromStorage : null
  }, [])

  const pcId = useMemo(() => {
    const envPcId = typeof PHYSICAL_PC_ID === "string" ? Number.parseInt(PHYSICAL_PC_ID, 10) : null
    if (envPcId !== null && Number.isFinite(envPcId)) return envPcId
    const raw = localStorage.getItem("pcId")
    if (!raw) return null
    const parsed = Number.parseInt(raw, 10)
    return Number.isFinite(parsed) ? parsed : null
  }, [])

  useEffect(() => {
    localStorage.setItem("coin", String(coin))
  }, [coin])

  useEffect(() => {
    if (!isQrOpen) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsQrOpen(false)
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [isQrOpen])

  const confirmTopUp = async (amount: number) => {
    setTopupError(null)

    if (!userId) {
      setTopupError("User ID belum ada. Coba login ulang dulu ya.")
      return
    }

    if (!pcId) {
      setTopupError("PC ID belum ada. Coba login ulang dulu ya.")
      return
    }

    if (!authToken) {
      setTopupError("Token login belum ada. Silakan login ulang dulu ya.")
      return
    }

    setIsTopupLoading(true)

    try {
      const response = await fetch(`${BASEURL}/api/user/topup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          userId,
          pcId,
          amount,
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
      setPendingTopupAmount(null)
    } catch (error) {
      console.error("Top up error:", error)
      setTopupError(error instanceof Error ? error.message : "Top up gagal. Coba lagi ya.")
    } finally {
      setIsTopupLoading(false)
    }
  }

  const startTopUpFlow = () => {
    setTopupError(null)

    const amount = toPositiveInt(topupAmount)
    if (!amount) {
      setTopupError("Jumlah top up harus angka > 0.")
      return
    }

    if (!userId) {
      setTopupError("User ID belum ada. Coba login ulang dulu ya.")
      return
    }

    if (!authToken) {
      setTopupError("Token login belum ada. Silakan login ulang dulu ya.")
      return
    }

    setPendingTopupAmount(amount)
  }

  const openQrForPayment = (method: PaymentMethod) => {
    if (!pendingTopupAmount) {
      setTopupError("Isi jumlah top up dulu ya, baru pilih metode pembayaran.")
      return
    }
    setPaymentMethod(method)
    setIsQrOpen(true)
  }

  const closeQrAndApplyTopUp = () => {
    setIsQrOpen(false)
    if (pendingTopupAmount && !isTopupLoading) confirmTopUp(pendingTopupAmount)
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

        <button className="btn" onClick={startTopUpFlow} disabled={isTopupLoading || !!pendingTopupAmount}>
          {isTopupLoading ? "Memproses..." : "Top Up"}
        </button>
        {pendingTopupAmount ? (
          <p className="wallet-hint">Silakan pilih metode pembayaran untuk top up {pendingTopupAmount} coin.</p>
        ) : null}
      </div>

      <div className="card payment-card">
        <h3 className="payment-title">Metode Pembayaran</h3>

        <button
          type="button"
          className={`payment-option ${paymentMethod === "bank" ? "selected" : ""}`}
          onClick={() => openQrForPayment("bank")}
          disabled={!pendingTopupAmount || isTopupLoading}
        >
          <span className="payment-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <rect x="4" y="6" width="16" height="12" rx="2" />
              <path d="M4 10h16" />
            </svg>
          </span>
          <span>
            <span className="payment-name">Transfer Bank</span>
            <span className="payment-detail">BCA / Mandiri / BRI / OVO / Gopay </span>
          </span>
        </button>
      </div>

      {isQrOpen ? (
        <div
          className="qr-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setIsQrOpen(false)
          }}
        >
          <div className="qr-modal" role="dialog" aria-modal="true" aria-label="QR Transfer Bank">
            <div className="qr-modal-header">
              <h3 className="qr-modal-title">Scan QR untuk Transfer Bank</h3>
              <button type="button" className="qr-close" onClick={closeQrAndApplyTopUp} disabled={isTopupLoading}>
                {isTopupLoading ? "Memproses..." : "Tutup"}
              </button>
            </div>

            <div className="qr-box" aria-label="QR untuk transfer bank">
              <img className="qr-image" src={qrCodeRickroll} alt="QR transfer bank" />
            </div>

            <p className="qr-hint">Scan QR lalu lakukan transfer. Setelah selesai, klik <strong>Tutup</strong>.</p>
          </div>
        </div>
      ) : null}
    </section>
  )
}
