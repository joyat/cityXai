"use client";

import { useEffect, useState } from "react";
import { Shell } from "../../components/shell";
import { apiFetch } from "../../lib/api";

export default function AuditPage() {
  const [items, setItems] = useState<any[]>([]);
  const [flaggedOnly, setFlaggedOnly] = useState(false);

  async function load() {
    const data = await apiFetch(`/api/admin/audit${flaggedOnly ? "?flagged=true" : ""}`).then((r) => r.json());
    setItems(data.items || []);
  }

  useEffect(() => { load(); }, [flaggedOnly]);

  function formatTs(ts: string) {
    try { return new Date(ts).toLocaleString("de-DE"); } catch { return ts; }
  }

  return (
    <Shell>
      <div className="header">
        <div>
          <h1>Auditprotokoll</h1>
          <p>Hash-basierte, filterbare Nachvollziehbarkeit gemäß KI-Verordnung Art. 12.</p>
        </div>
        <div style={{ display:"flex", gap:10, alignItems:"center" }}>
          <label style={{ display:"flex", alignItems:"center", gap:6, fontSize:"0.82rem", color:"var(--text-muted)", cursor:"pointer", margin:0 }}>
            <input type="checkbox" checked={flaggedOnly} onChange={() => setFlaggedOnly(!flaggedOnly)} style={{ width:"auto", accentColor:"var(--warning)" }} />
            Nur markierte
          </label>
          <a href="/api/admin/audit?export=csv">
            <button className="secondary" style={{ padding:"8px 14px" }}>CSV Export</button>
          </a>
        </div>
      </div>

      <div className="card">
        {items.length === 0 ? (
          <p style={{ textAlign:"center", color:"var(--text-muted)", padding:"32px 0", fontSize:"0.875rem" }}>
            Keine Einträge gefunden.
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Zeitpunkt</th>
                <th>Rolle</th>
                <th>Nutzer-Hash</th>
                <th>Dokumente</th>
                <th>Latenz</th>
                <th>Markiert</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={idx} className={item.flagged ? "flagged" : ""}>
                  <td className="mono">{formatTs(item.timestamp)}</td>
                  <td><span className="badge">{item.user_role}</span></td>
                  <td><span className="mono" style={{ fontSize:"0.68rem" }}>{String(item.user_id_hash || "").slice(0,16)}…</span></td>
                  <td style={{ color:"var(--text-muted)", fontSize:"0.8rem" }}>{(item.retrieved_doc_ids || []).length} Dok.</td>
                  <td className="mono">{item.latency_ms} ms</td>
                  <td>
                    {item.flagged
                      ? <span className="badge warning">⚠ Ja</span>
                      : <span className="badge success">✓ Nein</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Shell>
  );
}
