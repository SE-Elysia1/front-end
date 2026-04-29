import { useEffect, useMemo, useState } from "react"
import "./setting.css"

const BASEURL = import.meta.env.VITE_BASEURL

const toString = (value: unknown) => (typeof value === "string" ? value : null)

const getMessage = (payload: unknown) => {
  if (!payload || typeof payload !== "object") return null
  const obj = payload as Record<string, unknown>
  if (typeof obj.message === "string" && obj.message.trim()) return obj.message.trim()
  const data = obj.data
  if (data && typeof data === "object") {
    const d = data as Record<string, unknown>
    if (typeof d.message === "string" && d.message.trim()) return d.message.trim()
  }
  return null
}

export default function Settings() {
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

  const [username, setUsername] = useState(() => localStorage.getItem("username") ?? "")
  const [isEditing, setIsEditing] = useState(false)
  const [isProfileLoading, setIsProfileLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [newUsername, setNewUsername] = useState(username)
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  useEffect(() => {
    if (!userId || !authToken) return

    const controller = new AbortController()
    setIsProfileLoading(true)

    ;(async () => {
      try {
        const response = await fetch(`${BASEURL}/api/user/${userId}`, {
          signal: controller.signal,
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        })

        const payload: unknown = await response.json().catch(() => null)
        if (!response.ok) throw new Error(getMessage(payload) || `Gagal memuat profil (${response.status})`)

        const obj = payload as Record<string, unknown>
        const data = (obj?.data && typeof obj.data === "object" ? (obj.data as Record<string, unknown>) : null) ?? obj
        const serverUsername =
          toString(data?.username) ??
          toString(data?.userName) ??
          toString((data?.user && typeof data.user === "object" ? (data.user as Record<string, unknown>).username : null))

        if (serverUsername && serverUsername.trim()) {
          const normalized = serverUsername.trim()
          localStorage.setItem("username", normalized)
          setUsername(normalized)
          setNewUsername(normalized)
        }
      } catch (e) {
        if (controller.signal.aborted) return
        setError(e instanceof Error ? e.message : "Gagal memuat profil.")
      } finally {
        if (!controller.signal.aborted) setIsProfileLoading(false)
      }
    })()

    return () => controller.abort()
  }, [userId, authToken])

  const startEdit = () => {
    setError(null)
    setSuccess(null)
    setIsEditing(true)
    setNewUsername(username)
    setCurrentPassword("")
    setNewPassword("")
    setConfirmPassword("")
  }

  const save = async () => {
    setError(null)
    setSuccess(null)

    if (!userId) return setError("User ID belum ada. Coba login ulang dulu ya.")
    if (!authToken) return setError("Token login belum ada. Silakan login ulang dulu ya.")

    const normalizedUsername = newUsername.trim()
    if (!normalizedUsername) return setError("Username tidak boleh kosong.")

    if (!currentPassword.trim()) return setError("Password saat ini wajib diisi untuk menyimpan perubahan.")

    if (newPassword || confirmPassword) {
      if (newPassword !== confirmPassword) return setError("Confirm password tidak sama.")
      if (!newPassword.trim()) return setError("Password baru tidak boleh kosong.")
    }

    setIsSaving(true)
    try {
      const response = await fetch(`${BASEURL}/api/user/manage/${userId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          currentPassword,
          newUsername: normalizedUsername,
          newPassword: newPassword.trim(),
        }),
      })

      const payload: unknown = await response.json().catch(() => null)
      if (!response.ok) throw new Error(getMessage(payload) || `Gagal menyimpan (${response.status})`)

      localStorage.setItem("username", normalizedUsername)
      setUsername(normalizedUsername)
      setSuccess(getMessage(payload) || "Berhasil disimpan.")
      setIsEditing(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menyimpan. Coba lagi ya.")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section className="page settings-page">
      <header className="page-header">
        <h2 className="page-title">Pengaturan</h2>
      </header>

      <div className="card profile-card">
        <h3 className="profile-title">Profil Pengguna</h3>

        <div className="profile-form">
          <label className="profile-field">
            <span className="profile-label">Username</span>
            <input
              className="profile-input"
              type="text"
              value={isEditing ? newUsername : username}
              onChange={(e) => setNewUsername(e.target.value)}
              disabled={!isEditing || isSaving || isProfileLoading}
              autoComplete="username"
            />
          </label>

          <label className="profile-field">
            <span className="profile-label">{isEditing ? "Password Saat Ini" : "Password"}</span>
            <input
              className="profile-input"
              type="password"
              value={isEditing ? currentPassword : "********"}
              onChange={(e) => setCurrentPassword(e.target.value)}
              disabled={!isEditing || isSaving || isProfileLoading}
              autoComplete="current-password"
            />
          </label>

          {isEditing ? (
            <label className="profile-field">
              <span className="profile-label">Password Baru</span>
              <input
                className="profile-input"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={isSaving || isProfileLoading}
                autoComplete="new-password"
              />
            </label>
          ) : null}

          {isEditing ? (
            <label className="profile-field">
              <span className="profile-label">Confirm Password</span>
              <input
                className="profile-input"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isSaving || isProfileLoading}
                autoComplete="new-password"
              />
            </label>
          ) : null}
        </div>

        {error ? <p className="profile-error">{error}</p> : null}
        {success ? <p className="profile-success">{success}</p> : null}

        <div className="profile-actions">
          {isEditing ? (
            <button className="btn" type="button" onClick={save} disabled={isSaving}>
              {isSaving ? "Menyimpan..." : "Save"}
            </button>
          ) : (
            <button className="btn" type="button" onClick={startEdit} disabled={isProfileLoading}>
              {isProfileLoading ? "Memuat..." : "Edit"}
            </button>
          )}
        </div>
      </div>
    </section>
  )
}
