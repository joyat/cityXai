"use client";

import { useEffect, useState } from "react";
import { Shell } from "../../components/shell";
import { useI18n } from "../../lib/i18n";
import { apiFetch } from "../../lib/api";

export default function AuditPage() {
  const { language } = useI18n();
  const [items, setItems] = useState<any[]>([]);
  const [flaggedOnly, setFlaggedOnly] = useState(false);

  async function load() {
    const data = await apiFetch(`/api/admin/audit${flaggedOnly ? "?flagged=true" : ""}`).then((r) => r.json());
    setItems(data.items || []);
  }

  useEffect(() => { load(); }, [flaggedOnly]);

  function formatTs(ts: string) {
    try { return new Date(ts).toLocaleString(language === "de" ? "de-DE" : "en-GB"); } catch { return ts; }
  }

  return (
    <Shell>
      <div className="header">
        <div>
          <h1>{language === "de" ? "Auditprotokoll" : "Audit Log"}</h1>
          <p>{language === "de" ? "Hash-basierte, filterbare Nachvollziehbarkeit gemäß KI-Verordnung Art. 12." : "Hash-based, filterable traceability aligned with AI Act Art. 12."}</p>
        </div>
        <div style={{ display:"flex", gap:10, alignItems:"center" }}>
          <label style={{ display:"flex", alignItems:"center", gap:6, fontSize:"0.82rem", color:"var(--text-muted)", cursor:"pointer", margin:0 }}>
            <input type="checkbox" checked={flaggedOnly} onChange={() => setFlaggedOnly(!flaggedOnly)} style={{ width:"auto", accentColor:"var(--warning)" }} />
            {language === "de" ? "Nur markierte" : "Flagged only"}
          </label>
          <a href="/api/admin/audit?export=csv">
            <button className="secondary" style={{ padding:"8px 14px" }}>{language === "de" ? "CSV Export" : "Export CSV"}</button>
          </a>
        </div>
      </div>

      <div className="card">
        {items.length === 0 ? (
          <p style={{ textAlign:"center", color:"var(--text-muted)", padding:"32px 0", fontSize:"0.875rem" }}>
            {language === "de" ? "Keine Einträge gefunden." : "No entries found."}
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>{language === "de" ? "Zeitpunkt" : "Timestamp"}</th>
                <th>{language === "de" ? "Rolle" : "Role"}</th>
                <th>{language === "de" ? "Nutzer-Hash" : "User hash"}</th>
                <th>{language === "de" ? "Dokumente" : "Documents"}</th>
                <th>{language === "de" ? "Latenz" : "Latency"}</th>
                <th>{language === "de" ? "Markiert" : "Flagged"}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={idx} className={item.flagged ? "flagged" : ""}>
                  <td className="mono">{formatTs(item.timestamp)}</td>
                  <td><span className="badge">{item.user_role}</span></td>
                  <td><span className="mono" style={{ fontSize:"0.68rem" }}>{String(item.user_id_hash || "").slice(0,16)}…</span></td>
                  <td style={{ color:"var(--text-muted)", fontSize:"0.8rem" }}>{(item.retrieved_doc_ids || []).length} {language === "de" ? "Dok." : "docs"}</td>
                  <td className="mono">{item.latency_ms} ms</td>
                  <td>
                    {item.flagged
                      ? <span className="badge warning">⚠ {language === "de" ? "Ja" : "Yes"}</span>
                      : <span className="badge success">✓ {language === "de" ? "Nein" : "No"}</span>}
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
