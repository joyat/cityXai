"use client";

import { useEffect, useState } from "react";
import { Shell } from "../../components/shell";
import { apiFetch } from "../../lib/api";

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<any[]>([]);
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState("");

  async function load() {
    const data = await apiFetch("/api/ingest/documents").then((r) => r.json());
    setDocuments(data.documents || []);
  }

  useEffect(() => { load(); }, []);

  async function upload(file?: File) {
    if (!file) return;
    setStatus("Upload läuft…");
    const form = new FormData();
    form.append("file", file);
    form.append("classification", "public");
    form.append("department", "Bürgerservice");
    const response = await apiFetch("/api/ingest/upload", { method:"POST", body:form });
    const job = await response.json();
    setStatus(`Verarbeitung gestartet…`);
    const poll = setInterval(async () => {
      const current = await apiFetch(`/api/ingest/status/${job.job_id}`).then((r) => r.json());
      setStatus(`Status: ${current.status === "ready" ? "Bereit ✓" : current.status === "failed" ? "Fehler ✗" : "Verarbeitung…"}`);
      if (current.status !== "processing") {
        clearInterval(poll);
        setPreview(current.preview_md);
        load();
      }
    }, 1500);
  }

  async function remove(docId: string) {
    await apiFetch(`/api/ingest/document/${docId}`, { method:"DELETE" });
    load();
  }

  return (
    <Shell>
      <div className="header">
        <div>
          <h1>Dokumentbibliothek</h1>
          <p>Upload, Statusverfolgung und Markdown-Vorschau.</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom:16 }}>
        <label className="dropzone">
          <input type="file" hidden onChange={(e) => upload(e.target.files?.[0])} />
          <div style={{ fontSize:28, marginBottom:10 }}>📄</div>
          <strong>Datei hier ablegen oder klicken</strong>
          <p>PDF, DOCX, XLSX, PPTX, Bilder, CSV, HTML</p>
        </label>
        {status && <p style={{ textAlign:"center", marginTop:12, fontSize:"0.84rem", color:"var(--cyan)" }}>{status}</p>}
      </div>

      <div className="card">
        {documents.length === 0 ? (
          <p style={{ textAlign:"center", color:"var(--text-muted)", padding:"32px 0", fontSize:"0.875rem" }}>
            Noch keine Dokumente hochgeladen.
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Dateiname</th>
                <th>Typ</th>
                <th>Status</th>
                <th>Chunks</th>
                <th>Hochgeladen</th>
                <th>Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((doc) => (
                <tr key={doc.doc_id}>
                  <td style={{ fontWeight:500 }}>{doc.filename}</td>
                  <td><span className="mono">{doc.content_type || "—"}</span></td>
                  <td><span className="badge success">Bereit</span></td>
                  <td style={{ color:"var(--text-muted)" }}>{doc.chunk_count}</td>
                  <td className="mono">{doc.created_at ? new Date(doc.created_at).toLocaleDateString("de-DE") : "—"}</td>
                  <td>
                    <div style={{ display:"flex", gap:8 }}>
                      <button className="secondary" onClick={() => setPreview(JSON.stringify(doc, null, 2))} style={{ padding:"6px 12px", fontSize:"0.78rem" }}>
                        Vorschau
                      </button>
                      <button className="danger-btn" onClick={() => remove(doc.doc_id)} style={{ padding:"6px 12px", fontSize:"0.78rem" }}>
                        Löschen
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {preview && (
        <div className="modal" onClick={() => setPreview(null)}>
          <div onClick={(e) => e.stopPropagation()}>
            <div className="header">
              <h3 style={{ fontSize:"1rem" }}>Markdown-Vorschau</h3>
              <button className="secondary" onClick={() => setPreview(null)} style={{ padding:"6px 14px" }}>Schließen</button>
            </div>
            <pre>{preview}</pre>
          </div>
        </div>
      )}
    </Shell>
  );
}
