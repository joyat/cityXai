"use client";

import { useEffect, useState } from "react";

import { Shell } from "../../components/shell";
import { apiFetch } from "../../lib/api";

const services = ["nginx", "frontend", "chat-api", "ingest-api", "admin-api", "ollama", "chromadb", "keycloak", "prometheus", "grafana"];

export default function DashboardPage() {
  const [summary, setSummary] = useState<any>(null);
  useEffect(() => {
    apiFetch("/api/admin/metrics/summary").then((r) => r.json()).then(setSummary);
  }, []);

  return (
    <Shell>
      <div className="header">
        <div>
          <h1>Dashboard</h1>
          <p>Überblick über Dokumente, Anfragen und Systemzustand.</p>
        </div>
      </div>
      <div className="grid cols-4">
        <div className="card"><h3>Dokumente</h3><strong>{summary?.total_documents ?? "-"}</strong></div>
        <div className="card"><h3>Anfragen 24h</h3><strong>{summary?.total_queries_24h ?? "-"}</strong></div>
        <div className="card"><h3>Ø Latenz</h3><strong>{Math.round(summary?.avg_latency_ms ?? 0)} ms</strong></div>
        <div className="card"><h3>Speicher</h3><strong>{summary ? `${(summary.storage_bytes / 1024 / 1024).toFixed(2)} MB` : "-"}</strong></div>
      </div>
      <div className="grid cols-2" style={{ marginTop: 16 }}>
        <div className="card">
          <h3>Anfragevolumen 24h</h3>
          <div className="sparkline">
            <svg viewBox="0 0 100 40" preserveAspectRatio="none">
              <polyline fill="none" stroke="#005b96" strokeWidth="2" points="0,30 10,28 20,26 30,24 40,18 50,20 60,14 70,18 80,10 90,12 100,8" />
            </svg>
          </div>
        </div>
        <div className="card">
          <h3>Systemstatus</h3>
          <div className="grid cols-2">
            {services.map((service) => (
              <div key={service} className="badge success">{service}: online</div>
            ))}
          </div>
        </div>
      </div>
    </Shell>
  );
}
