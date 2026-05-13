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

const resolvePcId = () => {
  const fromStorage = Number.parseInt(localStorage.getItem("pcId")?.trim() ?? "", 10);
  if (Number.isFinite(fromStorage) && fromStorage > 0) return fromStorage;
  const fromEnv = Number.parseInt((import.meta.env.VITE_PC_ID as string | undefined)?.trim() ?? "", 10);
  if (Number.isFinite(fromEnv) && fromEnv > 0) return fromEnv;
  return null;
};

type ManagedUserRow = {
  id: number;
  username: string;
  balanceCoin: number;
};

type EditModalState = {
  open: boolean;
  userId: number | null;
  username: string;
  newUsername: string;
  newPassword: string;
  confirmPassword: string;
  isLoading: boolean;
  error: string | null;
};

type DeleteModalState = {
  open: boolean;
  userId: number | null;
  username: string;
  isLoading: boolean;
  error: string | null;
};

const EDIT_MODAL_DEFAULT: EditModalState = {
  open: false,
  userId: null,
  username: "",
  newUsername: "",
  newPassword: "",
  confirmPassword: "",
  isLoading: false,
  error: null,
};

const DELETE_MODAL_DEFAULT: DeleteModalState = {
  open: false,
  userId: null,
  username: "",
  isLoading: false,
  error: null,
};

export default function KelolaUser() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<ManagedUserRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editModal, setEditModal] = useState<EditModalState>(EDIT_MODAL_DEFAULT);
  const [deleteModal, setDeleteModal] = useState<DeleteModalState>(DELETE_MODAL_DEFAULT);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const userId = useMemo(() => localStorage.getItem("userId")?.trim() ?? "", []);
  const authToken = useMemo(() => localStorage.getItem("token")?.trim() ?? "", []);
  const role = useMemo(() => localStorage.getItem("role")?.toLowerCase() ?? "user", []);

  // ── Toast helper ──────────────────────────────────────────────
  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // ── Fetch users ───────────────────────────────────────────────
  const fetchUsers = useCallback(async () => {
    if (!authToken || !userId) return;
    setIsLoading(true);
    try {
      const response = await fetch(`${BASEURL}/api/admin/users`, {
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

  // ── Logout ────────────────────────────────────────────────────
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

  // ── Edit handlers ─────────────────────────────────────────────
  const openEditModal = (row: ManagedUserRow) => {
    setEditModal({
      ...EDIT_MODAL_DEFAULT,
      open: true,
      userId: row.id,
      username: row.username,
      newUsername: row.username,
    });
  };

  const closeEditModal = () => {
    if (editModal.isLoading) return;
    setEditModal(EDIT_MODAL_DEFAULT);
  };

  const handleEditSubmit = async () => {
    const { userId: targetId, newUsername, newPassword, confirmPassword } = editModal;
    if (!targetId) return;

    // Validation
    if (!newUsername.trim()) {
      setEditModal((prev) => ({ ...prev, error: "Username tidak boleh kosong." }));
      return;
    }
    if (newPassword && newPassword !== confirmPassword) {
      setEditModal((prev) => ({ ...prev, error: "Konfirmasi password tidak cocok." }));
      return;
    }

    const body: Record<string, string> = {};
    if (newUsername.trim() !== editModal.username) body.newUsername = newUsername.trim();
    if (newPassword) body.newPassword = newPassword;

    if (Object.keys(body).length === 0) {
      setEditModal((prev) => ({ ...prev, error: "Tidak ada perubahan yang dilakukan." }));
      return;
    }

    setEditModal((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      const response = await fetch(`${BASEURL}/api/admin/user/${targetId}/override`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error((errData as Record<string, string>).message ?? `Error ${response.status}`);
      }

      showToast(`User "${editModal.username}" berhasil diperbarui.`, "success");
      setEditModal(EDIT_MODAL_DEFAULT);
      fetchUsers();
    } catch (err) {
      setEditModal((prev) => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : "Terjadi kesalahan.",
      }));
    }
  };

  // ── Delete handlers ───────────────────────────────────────────
  const openDeleteModal = (row: ManagedUserRow) => {
    setDeleteModal({ ...DELETE_MODAL_DEFAULT, open: true, userId: row.id, username: row.username });
  };

  const closeDeleteModal = () => {
    if (deleteModal.isLoading) return;
    setDeleteModal(DELETE_MODAL_DEFAULT);
  };

  const handleDeleteConfirm = async () => {
    const { userId: targetId, username } = deleteModal;
    if (!targetId) return;

    setDeleteModal((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      const response = await fetch(`${BASEURL}/api/admin/user/${targetId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${authToken}` },
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error((errData as Record<string, string>).message ?? `Error ${response.status}`);
      }

      showToast(`User "${username}" berhasil dihapus.`, "success");
      setDeleteModal(DELETE_MODAL_DEFAULT);
      fetchUsers();
    } catch (err) {
      setDeleteModal((prev) => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : "Terjadi kesalahan.",
      }));
    }
  };

  // ── Filter ────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => row.username.toLowerCase().includes(q));
  }, [query, rows]);

  // ── Render ────────────────────────────────────────────────────
  return (
    <section className="admin-dashboard-page">
      {/* ── Toast ── */}
      {toast && (
        <div
          className={`kelola-user-toast kelola-user-toast--${toast.type}`}
          role="alert"
          aria-live="polite"
        >
          {toast.message}
        </div>
      )}

      {/* ── Edit Modal ── */}
      {editModal.open && (
        <div className="kelola-user-modal-overlay" onClick={closeEditModal} role="dialog" aria-modal="true" aria-label="Edit User">
          <div className="kelola-user-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="kelola-user-modal-title">Edit User</h3>
            <p className="kelola-user-modal-subtitle">Mengedit: <strong>{editModal.username}</strong></p>

            <div className="kelola-user-modal-field">
              <label htmlFor="edit-username">Username Baru</label>
              <input
                id="edit-username"
                type="text"
                value={editModal.newUsername}
                onChange={(e) => setEditModal((prev) => ({ ...prev, newUsername: e.target.value, error: null }))}
                disabled={editModal.isLoading}
                autoComplete="off"
              />
            </div>

            <div className="kelola-user-modal-field">
              <label htmlFor="edit-password">Password Baru <span className="kelola-user"></span></label>
              <input
                id="edit-password"
                type="password"
                value={editModal.newPassword}
                onChange={(e) => setEditModal((prev) => ({ ...prev, newPassword: e.target.value, error: null }))}
                disabled={editModal.isLoading}
                placeholder="Isi Password Baru"
                autoComplete="new-password"
              />
            </div>

            {editModal.newPassword && (
              <div className="kelola-user-modal-field">
                <label htmlFor="edit-confirm-password">Konfirmasi Password</label>
                <input
                  id="edit-confirm-password"
                  type="password"
                  value={editModal.confirmPassword}
                  onChange={(e) => setEditModal((prev) => ({ ...prev, confirmPassword: e.target.value, error: null }))}
                  disabled={editModal.isLoading}
                  autoComplete="new-password"
                />
              </div>
            )}

            {editModal.error && <p className="kelola-user-modal-error">{editModal.error}</p>}

            <div className="kelola-user-modal-actions">
              <button
                type="button"
                className="kelola-user-modal-btn kelola-user-modal-btn--cancel"
                onClick={closeEditModal}
                disabled={editModal.isLoading}
              >
                Batal
              </button>
              <button
                type="button"
                className="kelola-user-modal-btn kelola-user-modal-btn--confirm"
                onClick={handleEditSubmit}
                disabled={editModal.isLoading}
              >
                {editModal.isLoading ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm Modal ── */}
      {deleteModal.open && (
        <div className="kelola-user-modal-overlay" onClick={closeDeleteModal} role="dialog" aria-modal="true" aria-label="Hapus User">
          <div className="kelola-user-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="kelola-user-modal-title kelola-user-modal-title--danger">Hapus User</h3>
            <p className="kelola-user-modal-body">
              Apakah kamu yakin ingin menghapus user <strong>{deleteModal.username}</strong>?
              Tindakan ini tidak dapat dibatalkan.
            </p>

            {deleteModal.error && <p className="kelola-user-modal-error">{deleteModal.error}</p>}

            <div className="kelola-user-modal-actions">
              <button
                type="button"
                className="kelola-user-modal-btn kelola-user-modal-btn--cancel"
                onClick={closeDeleteModal}
                disabled={deleteModal.isLoading}
              >
                Batal
              </button>
              <button
                type="button"
                className="kelola-user-modal-btn kelola-user-modal-btn--danger"
                onClick={handleDeleteConfirm}
                disabled={deleteModal.isLoading}
              >
                {deleteModal.isLoading ? "Menghapus..." : "Hapus"}
              </button>
            </div>
          </div>
        </div>
      )}

      <aside className="admin-sidebar">
        <div className="admin-brand">
          <span className="admin-brand-icon" aria-hidden="true">BW</span>
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
                <path d="M12 3v4M12 17v4M3 12h4M17 12h4" />
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
                <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </span>
            Kelola User
          </button>
          <button className="admin-nav-item" type="button" onClick={() => navigate("/app/history-admin")}>
            <span className="admin-nav-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M4 12a8 8 0 1 0 2.3-5.7L4 8.6M4 4v4.6h4.6M12 8v4l3 2" />
              </svg>
            </span>
            Riwayat Transaksi
          </button>
          <button className="admin-nav-item" type="button" onClick={() => navigate("/app/laporan-keuangan-admin")}>
            <span className="admin-nav-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M6 4h12v3H6zM6 10h12v3H6zM6 16h12v3H6z" />
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
                    <button
                      type="button"
                      className="kelola-user-iconbtn"
                      aria-label={`Edit ${row.username}`}
                      onClick={() => openEditModal(row)}
                    >
                      <svg viewBox="0 0 24 24" fill="none">
                        <path d="M12 20h9" />
                        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      className="kelola-user-iconbtn kelola-user-iconbtn--danger"
                      aria-label={`Hapus ${row.username}`}
                      onClick={() => openDeleteModal(row)}
                    >
                      <svg viewBox="0 0 24 24" fill="none">
                        <path d="M3 6h18M8 6V4h8v2M6 6l1 16h10l1-16M10 11v6M14 11v6" />
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
