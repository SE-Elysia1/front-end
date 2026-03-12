import { NavLink, Outlet } from "react-router-dom"
import "./layout.css"

export default function MainLayout() {
  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-icon" aria-hidden="true">BW</span>
          <div>
            <p className="brand-title">Billing Warnet</p>
            <p className="brand-subtitle">Sistem Billing Digital</p>
          </div>
        </div>
        <nav className="sidebar-nav">
          <NavLink to="/app/dashboard" className={({ isActive }) => (isActive ? "active" : "")}>
            <span className="nav-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M3 10.5L12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1V10.5Z" />
              </svg>
            </span>
            Dashboard
          </NavLink>
          <NavLink to="/app/wallet" className={({ isActive }) => (isActive ? "active" : "")}>
            <span className="nav-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M3 8a3 3 0 0 1 3-3h11a2 2 0 0 1 2 2v1h1a2 2 0 0 1 2 2v7a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V8Z" />
                <circle cx="17.5" cy="13.5" r="1.5" />
              </svg>
            </span>
            Top Up Coin
          </NavLink>
          <NavLink to="/app/history" className={({ isActive }) => (isActive ? "active" : "")}>
            <span className="nav-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M4 12a8 8 0 1 0 2.3-5.7L4 8.6" />
                <path d="M4 4v4.6h4.6" />
                <path d="M12 8v4l3 2" />
              </svg>
            </span>
            Riwayat Transaksi
          </NavLink>
          <NavLink to="/app/settings" className={({ isActive }) => (isActive ? "active" : "")}>
            <span className="nav-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="m19.4 15 1.1 1.9-2.1 3.6-2.2-.6a7.8 7.8 0 0 1-2 .9l-.5 2.2H9.3l-.5-2.2a7.8 7.8 0 0 1-2-.9l-2.2.6-2.1-3.6L3.6 15a8 8 0 0 1 0-2l-1.1-1.9 2.1-3.6 2.2.6a7.8 7.8 0 0 1 2-.9l.5-2.2h4.4l.5 2.2a7.8 7.8 0 0 1 2 .9l2.2-.6 2.1 3.6-1.1 1.9a8 8 0 0 1 0 2Z" />
                <circle cx="12" cy="14" r="3" />
              </svg>
            </span>
            Pengaturan
          </NavLink>
        </nav>
      </aside>

      <main className="content">
        <Outlet />
      </main>
    </div>
  )
}
