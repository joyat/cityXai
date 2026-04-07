"use client";

const TOKEN_STORAGE_KEY = "cityxai_token";

export function getToken() {
  if (typeof document === "undefined") return "";
  const stored = window.localStorage.getItem(TOKEN_STORAGE_KEY);
  if (stored) return stored;
  const cookies = document.cookie
    .split("; ")
    .filter((entry) => entry.startsWith("cityxai_token="));
  const latest = cookies.at(-1)?.split("=")[1];
  return latest ? decodeURIComponent(latest) : "";
}

export function setToken(token: string) {
  if (typeof document === "undefined") return;
  window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
  document.cookie = `cityxai_token=${encodeURIComponent(token)}; Path=/; Max-Age=${60 * 60 * 8}; SameSite=Lax`;
}

export function clearToken() {
  if (typeof document === "undefined") return;
  window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  document.cookie = "cityxai_token=; Path=/; Max-Age=0; SameSite=Lax";
}

export async function apiFetch(path: string, options: RequestInit = {}) {
  const token = getToken();
  const headers = new Headers(options.headers || {});
  if (token) headers.set("Authorization", `Bearer ${token}`);
  headers.set("X-Namespace", process.env.NEXT_PUBLIC_NAMESPACE || "paderborn");
  if (!(options.body instanceof FormData)) headers.set("Content-Type", "application/json");
  const response = await fetch(path, { ...options, headers });
  if (response.status === 401) {
    window.location.href = "/login";
    throw new Error("Nicht angemeldet");
  }
  return response;
}
