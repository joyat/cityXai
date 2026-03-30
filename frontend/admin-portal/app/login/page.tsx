"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { LanguageSelector, useI18n } from "../../lib/i18n";
import { setToken } from "../../lib/api";

export default function LoginPage() {
  const { language } = useI18n();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/session-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: String(form.get("email") || ""),
          password: String(form.get("password") || "")
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || (language === "de" ? "Login fehlgeschlagen" : "Login failed"));
      if (data.access_token) {
        setToken(data.access_token);
      }
      window.location.href = data.redirect_to || "/dashboard";
    } catch (err) {
      setError(err instanceof Error ? err.message : (language === "de" ? "Login fehlgeschlagen" : "Login failed"));
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
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18, gap:12 }}>
          <Link
            href="/main/"
            style={{
              display:"inline-flex",
              alignItems:"center",
              gap:8,
              color:"var(--text-muted)",
              textDecoration:"none",
              fontSize:"0.8rem",
              border:"1px solid rgba(255,255,255,0.12)",
              background:"rgba(7,12,30,0.55)",
              padding:"8px 12px",
              borderRadius:"999px",
            }}
          >
            <span aria-hidden="true">←</span>
            {language === "de" ? "Zur Hauptseite" : "Back to main"}
          </Link>
          <LanguageSelector />
        </div>
        <div style={{ marginBottom:30, textAlign:"center" }}>
          <div style={{ display:"flex", justifyContent:"center", marginBottom:14 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.png"
              alt="cityXai"
              width={176}
              height={88}
              style={{ filter:"drop-shadow(0 0 18px rgba(0,212,255,0.3))", maxWidth:"100%", height:"auto" }}
            />
          </div>
          <h1 style={{
            fontSize:"1.65rem", fontWeight:700, letterSpacing:"-0.02em",
            background:"linear-gradient(135deg,#7ee8ff,#2ba8d4,#0d2b5e)",
            WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", backgroundClip:"text",
          }}>cityXai</h1>
          <p style={{ color:"var(--text-muted)", fontSize:"0.82rem", marginTop:5 }}>
            {language === "de" ? "Souveräne kommunale KI-Plattform" : "Sovereign municipal AI platform"}
          </p>
        </div>

        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <div>
            <label>{language === "de" ? "E-Mail-Adresse" : "Email address"}</label>
            <input name="email" type="email" placeholder={language === "de" ? "name@gemeinde.de" : "name@municipality.de"} autoComplete="email" />
          </div>
          <div>
            <label>{language === "de" ? "Passwort" : "Password"}</label>
            <input name="password" type="password" placeholder="••••••••" autoComplete="current-password" />
          </div>
        </div>

        <button type="submit" disabled={loading} style={{ marginTop:22, width:"100%", justifyContent:"center", padding:"12px 18px", fontSize:"0.9rem", opacity:loading?0.75:1 }}>
          {loading ? (language === "de" ? "Wird angemeldet…" : "Signing in…") : (language === "de" ? "Anmelden" : "Sign in")}
        </button>

        {error && <p className="text-danger" style={{ textAlign:"center" }}>{error}</p>}

        <p style={{ marginTop:22, textAlign:"center", fontSize:"0.7rem", color:"var(--text-faint)", lineHeight:1.6 }}>
          {language === "de" ? "DSGVO-konform · Lokal gehostet · KI-Verordnung Art. 13" : "GDPR-aligned · Locally hosted · AI Act Art. 13"}
        </p>
      </form>
    </div>
  );
}
