"use client";

import { useEffect, useState } from "react";

import { Shell } from "../../components/shell";
import { apiFetch } from "../../lib/api";

export default function AuditPage() {
  const [items, setItems] = useState<any[]>([]);
  const [flaggedOnly, setFlaggedOnly] = useState(false);

  async function load() {
    const data = await apiFetch(`/api/admin/audit?flagged=${flaggedOnly}`).then((r) => r.json());
    setItems(data.items || []);
  }

  useEffect(() => { load(); }, [flaggedOnly]);

  return (
    <Shell>
      <div className="header">
        <div><h1>Auditprotokoll</h1><p>Hash-basierte, filterbare Nachvollziehbarkeit gemäß KI-Verordnung.</p></div>
        <div style={{ display: "flex", gap: 12 }}>
          <label><input type="checkbox" checked={flaggedOnly} onChange={() => setFlaggedOnly(!flaggedOnly)} /> Nur markierte Fälle</label>
          <a href="/api/admin/audit?export=csv"><button>CSV exportieren</button></a>
        </div>
      </div>
      <div className="card">
        <table>
          <thead>
            <tr><th>Zeitpunkt</th><th>Rolle</th><th>Dokumente</th><th>Latenz</th><th>Markiert</th></tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr key={index}>
                <td>{item.timestamp}</td>
                <td>{item.user_role}</td>
                <td>{(item.retrieved_doc_ids || []).join(", ")}</td>
                <td>{item.latency_ms} ms</td>
                <td><span className={`badge ${item.flagged ? "warning" : "success"}`}>{item.flagged ? "Ja" : "Nein"}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}
