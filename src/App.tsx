import './App.css'
import React from 'react' 
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import Login from "./pages/login"
import MainLayout from "./layouts/MainLayouts"
import Dashboard from "./pages/dashboard"
import Wallet from "./pages/wallet"
import History from "./pages/history"
import Settings from "./pages/setting"


const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const pcId = localStorage.getItem("pcId");
  const username = localStorage.getItem("username");

  if (!pcId || !username) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>; 
};

const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const pcId = localStorage.getItem("pcId");
  if (pcId) {
    return <Navigate to="/app/dashboard" replace />;
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

        <Route path="/" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App