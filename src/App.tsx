import './App.css'
import React from 'react' 
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import Login from "./pages/login"
import MainLayout from "./layouts/MainLayouts"
import Dashboard from "./pages/dashboard"
import DashboardAdmin from "./pages/dashboardAdmin"
import MonitoringAdmin from "./pages/monitoringAdmin"
import KelolaUser from "./pages/kelolaUser"
import HistoryAdmin from "./pages/historyAdmin"
import LaporanKeuanganAdmin from "./pages/laporanKeuanganAdmin"
import Wallet from "./pages/wallet"
import History from "./pages/history"
import Settings from "./pages/setting"


const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const username = localStorage.getItem("username");
  const token = localStorage.getItem("token");

  if (!token || !username) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>; 
};

const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const token = localStorage.getItem("token");
  const role = localStorage.getItem("role")?.toLowerCase();
  if (token) {
    return <Navigate to={role === "admin" ? "/app/dashboard-admin" : "/app/dashboard"} replace />;
  }
  return <>{children}</>;
};

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        } />

        <Route path="/app" element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }>
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="wallet" element={<Wallet />} />
          <Route path="history" element={<History />} />
          <Route path="settings" element={<Settings />} />
        </Route>

        <Route
          path="/app/dashboard-admin"
          element={
            <ProtectedRoute>
              <DashboardAdmin />
            </ProtectedRoute>
          }
        />

        <Route
          path="/app/monitoring-admin"
          element={
            <ProtectedRoute>
              <MonitoringAdmin />
            </ProtectedRoute>
          }
        />

        <Route
          path="/app/kelola-user-admin"
          element={
            <ProtectedRoute>
              <KelolaUser />
            </ProtectedRoute>
          }
        />

        <Route
          path="/app/history-admin"
          element={
            <ProtectedRoute>
              <HistoryAdmin />
            </ProtectedRoute>
          }
        />

        <Route
          path="/app/laporan-keuangan-admin"
          element={
            <ProtectedRoute>
              <LaporanKeuanganAdmin />
            </ProtectedRoute>
          }
        />

        <Route path="/" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
