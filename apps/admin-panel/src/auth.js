import { useEffect } from "react";

const EXPECTED_ROLE = "ADMIN";
const TOKEN_KEY = "food_delivery_token";
const USER_KEY = "food_delivery_user";

function decodeToken(token) {
  try {
    const part = token.split(".")[1];
    return JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/")));
  } catch { return null; }
}

function valid(token) {
  const p = token && decodeToken(token);
  return !!(p?.sub && p?.role === EXPECTED_ROLE && p?.exp && p.exp * 1000 > Date.now());
}

export function getAuthenticatedUser() {
  const token = localStorage.getItem(TOKEN_KEY);
  const payload = token && decodeToken(token);
  if (!valid(token)) {
    localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); return null;
  }
  try {
    const stored = JSON.parse(localStorage.getItem(USER_KEY) || "null");
    return stored ? {...stored,id:payload.sub,role:payload.role} : payload;
  } catch { return payload; }
}

export function logout() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  window.location.replace("/login?logout=1");
}

export function useAppAuth() {
  useEffect(() => {
    const path = window.location.pathname;
    if (path === "/login" || path === "/register") return;

    const token = localStorage.getItem(TOKEN_KEY);
    const payload = token && decodeToken(token);
    if (!valid(token)) {
      localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY);
      const returnTo = `${window.location.pathname}${window.location.search}`;
      window.location.replace(`/login?returnTo=${encodeURIComponent(returnTo)}`);
      return;
    }
    if (payload?.role !== EXPECTED_ROLE) {
      localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY);
      window.location.replace("/login");
    }
  }, []);
}
