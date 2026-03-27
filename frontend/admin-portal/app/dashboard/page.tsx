"use client";

import { useEffect, useState } from "react";
import { Shell } from "../../components/shell";
import { apiFetch } from "../../lib/api";

const services = ["nginx","frontend","chat-api","ingest-api","admin-api","ollama","chromadb","keycloak","prometheus","grafana"];

export default function DashboardPage() {
  const [summary, setSummary] = useState<any>(null);
  useEffect(() => {
    apiFetch("/api/admin/metrics/summary").then((r) => r.json()).then(setSummary).catch(() => {});
  }, []);

  const metrics = [
    { label:"Dokumente",   value: summary?.total_documents    ?? "—", unit:"" },
    { label:"Anfragen 24h", value: summary?.total_queries_24h  ?? "—", unit:"" },
    { label:"Ø Latenz",    value: summary ? Math.round(summary.avg_latency_ms) : "—", unit:"ms" },
    { label:"Speicher",    value: summary ? (summary.storage_bytes/1024/1024).toFixed(1) : "—", unit:"MB" },
  ];

  return (
    <Shell>
      <div className="header">
        <div>
          <h1>Dashboard</h1>
          <p>Echtzeit-Überblick über Dokumente, Anfragen und Systemzustand.</p>
        </div>
      </div>

      <div className="grid cols-4" style={{ marginBottom:16 }}>
        {metrics.map((m) => (
          <div key={m.label} className="card card-accent">
            <h3>{m.label}</h3>
            <strong>{m.value}<span style={{ fontSize:"1rem", fontWeight:500, color:"var(--text-muted)", marginLeft:4 }}>{m.unit}</span></strong>
          </div>
        ))}
      </div>

      <div className="grid cols-2">
        <div className="card">
          <h3>Anfragevolumen 24h</h3>
          <div className="sparkline">
            <svg viewBox="0 0 200 52" preserveAspectRatio="none">
              <defs>
                <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00d4ff" stopOpacity="0.25"/>
                  <stop offset="100%" stopColor="#00d4ff" stopOpacity="0"/>
                </linearGradient>
              </defs>
              <polygon
                fill="url(#sparkFill)"
                points="0,52 0,38 20,35 40,32 60,28 80,22 100,26 120,18 140,22 160,12 180,15 200,8 200,52"
              />
              <polyline
                fill="none" stroke="#00d4ff" strokeWidth="2" strokeLinejoin="round"
                points="0,38 20,35 40,32 60,28 80,22 100,26 120,18 140,22 160,12 180,15 200,8"
              />
            </svg>
          </div>
        </div>

        <div className="card">
          <h3>Systemstatus</h3>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginTop:8 }}>
            {services.map((svc) => (
              <div key={svc} style={{ display:"flex", alignItems:"center", fontSize:"0.8rem", color:"var(--text-muted)" }}>
                <span className="status-dot" />
                {svc}
              </div>
            ))}
          </div>
        </div>
      </div>
    </Shell>
  );
}
