/* eslint-disable @typescript-eslint/no-unused-vars */
import "./login.css";
import pc from "../assets/pc_image.png";
import flyingcibi from "../assets/flyingcibi.png";
import makicibi from "../assets/makicibi.png";
import { useState } from "react";
import type { CSSProperties } from "react";
import { useNavigate } from "react-router-dom";

const PHYSICAL_PC_ID = import.meta.env.VITE_PC_ID;
const BASEURL = import.meta.env.VITE_BASEURL

const toFiniteNumber = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

const getUserIdFromResponse = (data: unknown) => {
  if (!data || typeof data !== "object") return null;
  const obj = data as Record<string, unknown>;

  const direct = toFiniteNumber(obj.userId) ?? toFiniteNumber(obj.id);
  if (direct !== null) return direct;

  const user = obj.user;
  if (user && typeof user === "object") {
    const userObj = user as Record<string, unknown>;
    const nested = toFiniteNumber(userObj.userId) ?? toFiniteNumber(userObj.id);
    if (nested !== null) return nested;
  }

  const payload = obj.data;
  if (payload && typeof payload === "object") {
    const payloadObj = payload as Record<string, unknown>;
    const nested = toFiniteNumber(payloadObj.userId) ?? toFiniteNumber(payloadObj.id);
    if (nested !== null) return nested;
  }

  return null;
};

const getCoinFromResponse = (data: unknown) => {
  if (!data || typeof data !== "object") return null;
  const obj = data as Record<string, unknown>;

  const direct =
    toFiniteNumber(obj.coin) ??
    toFiniteNumber(obj.totalCoin) ??
    toFiniteNumber(obj.balance) ??
    toFiniteNumber(obj.total);
  if (direct !== null) return direct;

  const payload = obj.data;
  if (payload && typeof payload === "object") {
    const payloadObj = payload as Record<string, unknown>;
    const nested =
      toFiniteNumber(payloadObj.coin) ??
      toFiniteNumber(payloadObj.totalCoin) ??
      toFiniteNumber(payloadObj.balance) ??
      toFiniteNumber(payloadObj.total);
    if (nested !== null) return nested;
  }

  return null;
};

const getTokenFromResponse = (data: unknown) => {
  if (!data || typeof data !== "object") return null;
  const obj = data as Record<string, unknown>;

  const direct =
    (typeof obj.token === "string" ? obj.token : null) ??
    (typeof obj.accessToken === "string" ? obj.accessToken : null) ??
    (typeof obj.jwt === "string" ? obj.jwt : null);
  if (direct) return direct;

  const payload = obj.data;
  if (payload && typeof payload === "object") {
    const payloadObj = payload as Record<string, unknown>;
    const nested =
      (typeof payloadObj.token === "string" ? payloadObj.token : null) ??
      (typeof payloadObj.accessToken === "string" ? payloadObj.accessToken : null) ??
      (typeof payloadObj.jwt === "string" ? payloadObj.jwt : null);
    if (nested) return nested;
  }

  return null;
};

export default function Login() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const navigate = useNavigate();

  const handleAuth = async () => {
    setError(null);
    setSuccess(null);

    if (!username || !password) {
      setError("Username and Password are required");
      return;
    }

    if (mode === "signup" && password !== confirmPassword) {
      setError("Passwords do not match!");
      return;
    }

    const endpoint =
    mode === "signin"
      ? `${BASEURL}/api/login`
      : `${BASEURL}/api/register`;

    try {
      const payload =
        mode === "signin"
          ? { username, password, pcId: parseInt(PHYSICAL_PC_ID) }
          : { username, password };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

       if (response.ok) {
         if (mode === "signin") {
           localStorage.setItem("username", username);
           localStorage.setItem("pcId", PHYSICAL_PC_ID);

            const userId = getUserIdFromResponse(data);
            if (userId !== null) localStorage.setItem("userId", String(userId));

            const coin = getCoinFromResponse(data);
            if (coin !== null) localStorage.setItem("coin", String(coin));

            const token = getTokenFromResponse(data);
            if (token) localStorage.setItem("token", token);

           navigate("/app/dashboard");
         } else {
           setSuccess("Registration successful! You can now Sign In.");
           setMode("signin");
           setPassword("");
          setConfirmPassword("");
        }
      } else {
        setError(
          data.message ||
            `${mode === "signin" ? "Login" : "Registration"} failed!`
        );
      }
    } catch (err) {
      setError("Network error! Is the backend running?");
    }
  };

  const getMotion = (
    left: number,
    top: number,
    strengthX: number,
    strengthY: number,
    mode: "outward" | "inward"
  ) => {
    const dx = mode === "outward" ? left - 50 : 50 - left;
    const dy = mode === "outward" ? top - 50 : 50 - top;
    const length = Math.sqrt(dx * dx + dy * dy) || 1;
    return {
      moveX: (dx / length) * strengthX,
      moveY: (dy / length) * strengthY,
    };
  };

  const pcBaseItems = [
    { left: 8, top: 15, duration: 7, delay: 0, size: 70, opacity: 0.18 },
    { left: 75, top: 20, duration: 8, delay: 2, size: 88, opacity: 0.22 },
    { left: 22, top: 72, duration: 7, delay: 1, size: 66, opacity: 0.16 },
    { left: 58, top: 62, duration: 6, delay: 4, size: 84, opacity: 0.2 },
    { left: 45, top: 12, duration: 9, delay: 3, size: 74, opacity: 0.17 },
    { left: 90, top: 45, duration: 6, delay: 6, size: 94, opacity: 0.2 },
    { left: 12, top: 88, duration: 8, delay: 5, size: 80, opacity: 0.19 },
    { left: 30, top: 26, duration: 7, delay: 1.5, size: 72, opacity: 0.17 },
    { left: 66, top: 14, duration: 8, delay: 2.5, size: 76, opacity: 0.2 },
    { left: 82, top: 82, duration: 7, delay: 0.8, size: 68, opacity: 0.18 },
    { left: 38, top: 88, duration: 9, delay: 3.8, size: 86, opacity: 0.21 },
    { left: 52, top: 40, duration: 6, delay: 4.5, size: 64, opacity: 0.15 },
  ];

  const pcItems = pcBaseItems.map((item, index) => ({
    ...item,
    ...getMotion(
      item.left,
      item.top,
      56,
      56,
      index % 2 === 0 ? "outward" : "inward"
    ),
  }));

  const flyingCibiBaseItems = [
    { left: 6, top: 28, duration: 6, delay: 0, size: 72, opacity: 0.28 },
    { left: 84, top: 18, duration: 8, delay: 2, size: 82, opacity: 0.3 },
    { left: 16, top: 78, duration: 7, delay: 1, size: 68, opacity: 0.26 },
    { left: 74, top: 70, duration: 8, delay: 4, size: 86, opacity: 0.32 },
    { left: 28, top: 12, duration: 7, delay: 0.6, size: 76, opacity: 0.27 },
    { left: 92, top: 54, duration: 6, delay: 3.2, size: 70, opacity: 0.29 },
    { left: 42, top: 86, duration: 8, delay: 1.8, size: 78, opacity: 0.3 },
    { left: 60, top: 32, duration: 7, delay: 2.7, size: 74, opacity: 0.28 },
  ];

  const flyingCibiItems = flyingCibiBaseItems.map((item, index) => ({
    ...item,
    ...getMotion(
      item.left,
      item.top,
      62,
      62,
      index % 2 === 0 ? "inward" : "outward"
    ),
  }));

  return (
    <div className="login-container">
      {pcItems.map((item, index) => (
        <img
          key={index}
          src={pc}
          alt=""
          className="pc-animation"
          style={
            {
              left: `${item.left}%`,
              top: `${item.top}%`,
              width: `${item.size}px`,
              opacity: item.opacity,
              animationDuration: `${item.duration}s`,
              animationDelay: `${item.delay}s`,
              "--move-x": `${item.moveX}vw`,
              "--move-y": `${item.moveY}vh`,
            } as CSSProperties
          }
        />
      ))}

      {flyingCibiItems.map((item, index) => (
        <img
          key={`flying-${index}`}
          src={flyingcibi}
          alt=""
          className="flyingcibi-animation"
          style={
            {
              left: `${item.left}%`,
              top: `${item.top}%`,
              width: `${item.size}px`,
              opacity: item.opacity,
              animationDuration: `${item.duration}s`,
              animationDelay: `${item.delay}s`,
              "--move-x": `${item.moveX}vw`,
              "--move-y": `${item.moveY}vh`,
            } as CSSProperties
          }
        />
      ))}

      <div className="login-box">
        <img src={makicibi} alt="makicibi" className="makicibi-corner" />
        <div className="auth-form-area">
          <h2>Billing Warnet</h2>
          <p className="pc-display-label">PC Number : PC-{PHYSICAL_PC_ID}</p>

          <div className="auth-mode-toggle">
            <button
              className={mode === "signin" ? "active" : ""}
              onClick={() => {
                setMode("signin");
                setError(null);
                setSuccess(null);
              }}
            >
              Sign In
            </button>
            <button
              className={mode === "signup" ? "active" : ""}
              onClick={() => {
                setMode("signup");
                setError(null);
                setSuccess(null);
              }}
            >
              Sign Up
            </button>
          </div>

          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {mode === "signup" && (
            <input
              type="password"
              placeholder="Confirm Password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          )}

          {error && (
            <div
              className="login-error-message"
              style={{
                color: "#ff4d4f",
                fontSize: "0.85rem",
                marginTop: "12px",
                textAlign: "center",
                fontWeight: "bold",
              }}
            >
              {error}
            </div>
          )}

          {success && (
            <div
              className="login-success-message"
              style={{
                color: "#52c41a",
                fontSize: "0.85rem",
                marginTop: "12px",
                textAlign: "center",
                fontWeight: "bold",
              }}
            >
              {success}
            </div>
          )}
        </div>

        <button onClick={handleAuth}>
          {mode === "signin" ? "Sign In" : "Register Account"}
        </button>
      </div>
    </div>
  );
}
