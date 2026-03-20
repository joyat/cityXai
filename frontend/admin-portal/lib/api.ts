"use client";

export function getToken() {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(/(?:^|; )cityxai_token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : "";
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
