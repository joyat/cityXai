"use client";

import { FormEvent, useState } from "react";

export default function LoginPage() {
  const [error, setError] = useState("");

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const params = new URLSearchParams();
    params.set("client_id", "paderobot-frontend");
    params.set("grant_type", "password");
    params.set("username", String(form.get("email")));
    params.set("password", String(form.get("password")));
    try {
      let response = await fetch("/keycloak/realms/paderobot/protocol/openid-connect/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params
      });
      let data = await response.json();
      if (!response.ok || !data.access_token) {
        response = await fetch("/api/dev-login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: String(form.get("email")),
            password: String(form.get("password"))
          })
        });
        data = await response.json();
      }
      if (!response.ok || !data.access_token) throw new Error(data.error_description || "Login fehlgeschlagen");
      document.cookie = `paderobot_token=${encodeURIComponent(data.access_token)}; Path=/; SameSite=Lax`;
      window.location.href = "/dashboard";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login fehlgeschlagen");
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <form className="card" onSubmit={login} style={{ width: "min(420px, 100%)" }}>
        <h1>PadeRoBot+ Anmeldung</h1>
        <p>Bitte mit Ihrem Keycloak-Konto anmelden.</p>
        <label>E-Mail</label>
        <input name="email" defaultValue="docadmin@demo.de" />
        <label>Passwort</label>
        <input name="password" type="password" defaultValue="Demo1234!" />
        <button type="submit" style={{ marginTop: 16, width: "100%" }}>Anmelden</button>
        {error ? <p style={{ color: "var(--danger)" }}>{error}</p> : null}
      </form>
    </div>
  );
}
