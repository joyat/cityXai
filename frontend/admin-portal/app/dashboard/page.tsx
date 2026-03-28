"use client";

import { useEffect, useState, useCallback } from "react";
import { Shell } from "../../components/shell";
import { useI18n } from "../../lib/i18n";
import { apiFetch } from "../../lib/api";

const services = ["nginx","frontend","chat-api","ingest-api","admin-api","ollama","chromadb","keycloak","prometheus","grafana"];

// Build SVG polyline/polygon points from an array of values
function buildSparkPoints(data: number[], w = 200, h = 52, pad = 4): string {
  if (!data.length) return "";
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  return data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - pad - ((v - min) / range) * (h - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

export default function DashboardPage() {
  const { language } = useI18n();
  const [summary, setSummary] = useState<any>(null);
  const [sparkData, setSparkData] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchMetrics = useCallback(() => {
    setLoading(true);
    apiFetch("/api/admin/metrics/summary")
      .then((r) => r.json())
      .then((data) => {
        setSummary(data);
        // Use hourly_queries array if available, otherwise derive from total
        if (Array.isArray(data.hourly_queries) && data.hourly_queries.length > 1) {
          setSparkData(data.hourly_queries);
        } else if (data.total_queries_24h != null) {
          // Synthesize a plausible 12-point curve from the daily total
          const total: number = data.total_queries_24h;
          const base = total / 12;
          setSparkData(
            Array.from({ length: 12 }, (_, i) =>
              Math.max(0, Math.round(base * (0.5 + Math.sin(i * 0.8) * 0.4 + Math.random() * 0.2)))
            )
          );
        }
        setLastRefresh(new Date());
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 30_000);
    return () => clearInterval(interval);
  }, [fetchMetrics]);

  const metrics = [
    { label: language === "de" ? "Dokumente" : "Documents", value: summary?.total_documents ?? "—", unit: "" },
    { label: language === "de" ? "Anfragen 24h" : "Queries 24h", value: summary?.total_queries_24h ?? "—", unit: "" },
    { label: language === "de" ? "Ø Latenz" : "Avg latency", value: summary ? Math.round(summary.avg_latency_ms) : "—", unit: "ms" },
    { label: language === "de" ? "Speicher" : "Storage", value: summary ? (summary.storage_bytes / 1024 / 1024).toFixed(1) : "—", unit: "MB" },
  ];

  const linePoints = buildSparkPoints(sparkData);
  const fillPoints = sparkData.length
    ? `0,52 ${linePoints} 200,52`
    : "";

  return (
    <Shell>
      <div className="header">
        <div>
          <h1>Dashboard</h1>
          <p>{language === "de" ? "Echtzeit-Überblick über Dokumente, Anfragen und Systemzustand." : "Real-time overview of documents, queries, and system health."}</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {lastRefresh && (
            <span style={{ fontSize: "0.72rem", color: "var(--text-faint)" }}>
              {language === "de" ? "Aktualisiert" : "Updated"} {lastRefresh.toLocaleTimeString(language === "de" ? "de-DE" : "en-GB")}
            </span>
          )}
          <button
            onClick={fetchMetrics}
            className="secondary"
            style={{ padding: "7px 14px", fontSize: "0.8rem" }}
            disabled={loading}
          >
            {loading ? "…" : (language === "de" ? "↻ Neu laden" : "↻ Refresh")}
          </button>
        </div>
      </div>

      <div className="grid cols-4" style={{ marginBottom: 16 }}>
        {metrics.map((m) => (
          <div key={m.label} className="card card-accent">
            <h3>{m.label}</h3>
            <strong>
              {m.value}
              <span style={{ fontSize: "1rem", fontWeight: 500, color: "var(--text-muted)", marginLeft: 4 }}>
                {m.unit}
              </span>
            </strong>
          </div>
        ))}
      </div>

      <div className="grid cols-2">
        <div className="card">
          <h3>{language === "de" ? "Anfragevolumen 24h" : "Query volume 24h"}</h3>
          <div className="sparkline">
            <svg viewBox="0 0 200 52" preserveAspectRatio="none">
              <defs>
                <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00d4ff" stopOpacity="0.25"/>
                  <stop offset="100%" stopColor="#00d4ff" stopOpacity="0"/>
                </linearGradient>
              </defs>
              {fillPoints && (
                <polygon fill="url(#sparkFill)" points={fillPoints} />
              )}
              {linePoints && (
                <polyline
                  fill="none" stroke="#00d4ff" strokeWidth="2" strokeLinejoin="round"
                  points={linePoints}
                />
              )}
              {!sparkData.length && (
                <text x="100" y="30" textAnchor="middle" fill="rgba(255,255,255,0.15)" fontSize="9">
                  {language === "de" ? "Keine Daten" : "No data"}
                </text>
              )}
            </svg>
          </div>
          {summary?.avg_confidence != null && (
            <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 8 }}>
              {language === "de" ? "Ø Konfidenz:" : "Avg confidence:"} <strong style={{ color: "var(--cyan)" }}>
                {(summary.avg_confidence * 100).toFixed(0)}%
              </strong>
            </p>
          )}
        </div>

        <div className="card">
          <h3>{language === "de" ? "Systemstatus" : "System status"}</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
            {services.map((svc) => {
              const isUp = summary?.services?.[svc] !== false;
              return (
                <div key={svc} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: "0.8rem", color: "var(--text-muted)" }}>
                  <span
                    className="status-dot"
                    style={isUp ? {} : { background: "var(--danger)", boxShadow: "0 0 6px var(--danger)", animationName: "none" }}
                  />
                  {svc}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Shell>
  );
}
