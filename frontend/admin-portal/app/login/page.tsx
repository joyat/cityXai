"use client";

import { FormEvent, useState } from "react";
import Image from "next/image";

export default function LoginPage() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const params = new URLSearchParams();
    params.set("client_id", "cityxai-frontend");
    params.set("grant_type", "password");
    params.set("username", String(form.get("email")));
    params.set("password", String(form.get("password")));
    try {
      let response = await fetch("/keycloak/realms/cityxai/protocol/openid-connect/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params,
      });
      let data = await response.json();
      if (!response.ok || !data.access_token) {
        response = await fetch("/api/dev-login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: String(form.get("email")), password: String(form.get("password")) }),
        });
        data = await response.json();
      }
      if (!response.ok || !data.access_token) throw new Error(data.error_description || "Login fehlgeschlagen");
      document.cookie = `cityxai_token=${encodeURIComponent(data.access_token)}; Path=/; SameSite=Lax`;
      window.location.href = "/dashboard";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login fehlgeschlagen");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight:"100vh", display:"grid", placeItems:"center", padding:"24px",
      background:"radial-gradient(ellipse at 30% 20%, rgba(0,212,255,0.13) 0%, transparent 50%), radial-gradient(ellipse at 70% 80%, rgba(26,122,181,0.11) 0%, transparent 50%), #0a0e27",
    }}>
      <div style={{ position:"fixed", inset:0, overflow:"hidden", pointerEvents:"none", zIndex:0 }}>
        <div style={{ position:"absolute", top:"10%", left:"6%", width:340, height:340, borderRadius:"50%", background:"rgba(0,212,255,0.05)", filter:"blur(70px)" }} />
        <div style={{ position:"absolute", bottom:"12%", right:"8%", width:300, height:300, borderRadius:"50%", background:"rgba(26,122,181,0.08)", filter:"blur(70px)" }} />
      </div>

      <form onSubmit={login} style={{
        position:"relative", zIndex:1, width:"min(400px, 100%)",
        background:"linear-gradient(135deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.02) 100%)",
        backdropFilter:"blur(18px)", WebkitBackdropFilter:"blur(18px)",
        border:"1px solid rgba(255,255,255,0.10)", borderRadius:"22px",
        padding:"40px 34px", boxShadow:"0 24px 80px rgba(0,0,0,0.5)",
      }}>
        <div style={{ marginBottom:30, textAlign:"center" }}>
          <div style={{ display:"flex", justifyContent:"center", marginBottom:14 }}>
            <Image
              src="/logo.svg"
              alt="cityXai"
              width={72}
              height={64}
              style={{ filter:"drop-shadow(0 0 18px rgba(0,212,255,0.45))" }}
            />
          </div>
          <h1 style={{
            fontSize:"1.65rem", fontWeight:700, letterSpacing:"-0.02em",
            background:"linear-gradient(135deg,#7ee8ff,#2ba8d4,#0d2b5e)",
            WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", backgroundClip:"text",
          }}>cityXai</h1>
          <p style={{ color:"var(--text-muted)", fontSize:"0.82rem", marginTop:5 }}>
            Souveräne kommunale KI-Plattform
          </p>
        </div>

        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <div>
            <label>E-Mail-Adresse</label>
            <input name="email" type="email" placeholder="name@gemeinde.de" autoComplete="email" />
          </div>
          <div>
            <label>Passwort</label>
            <input name="password" type="password" placeholder="••••••••" autoComplete="current-password" />
          </div>
        </div>

        <button type="submit" disabled={loading} style={{ marginTop:22, width:"100%", justifyContent:"center", padding:"12px 18px", fontSize:"0.9rem", opacity:loading?0.75:1 }}>
          {loading ? "Wird angemeldet…" : "Anmelden"}
        </button>

        {error && <p className="text-danger" style={{ textAlign:"center" }}>{error}</p>}

        <p style={{ marginTop:22, textAlign:"center", fontSize:"0.7rem", color:"var(--text-faint)", lineHeight:1.6 }}>
          DSGVO-konform · Lokal gehostet · KI-Verordnung Art. 13
        </p>
      </form>
    </div>
  );
}
