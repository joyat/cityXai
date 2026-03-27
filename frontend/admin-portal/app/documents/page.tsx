"use client";

import { useEffect, useRef, useState } from "react";
import { Shell } from "../../components/shell";
import { apiFetch } from "../../lib/api";

const DEPARTMENTS = [
  "Bürgerservice", "Standesamt", "Bauordnung", "Kämmerei",
  "Stadtplanung", "Ordnungsamt", "Sozialamt", "Schulverwaltung",
  "IT & Digitalisierung", "Personalamt",
];

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<any[]>([]);
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [classification, setClassification] = useState("public");
  const [department, setDepartment] = useState(DEPARTMENTS[0]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function load() {
    const data = await apiFetch("/api/ingest/documents").then((r) => r.json());
    setDocuments(data.documents || []);
  }

  useEffect(() => { load(); }, []);

  // Clean up any lingering poll on unmount
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  async function upload(file?: File) {
    if (!file) return;
    if (pollRef.current) clearInterval(pollRef.current);
    setStatus("Upload läuft…");
    const form = new FormData();
    form.append("file", file);
    form.append("classification", classification);
    form.append("department", department);
    try {
      const response = await apiFetch("/api/ingest/upload", { method: "POST", body: form });
      const job = await response.json();
      if (!job.job_id) throw new Error("Keine Job-ID erhalten.");
      setStatus("Verarbeitung gestartet…");

      let attempts = 0;
      pollRef.current = setInterval(async () => {
        attempts++;
        try {
          const current = await apiFetch(`/api/ingest/status/${job.job_id}`).then((r) => r.json());
          if (current.status === "ready") {
            clearInterval(pollRef.current!);
            setStatus("Bereit ✓");
            setPreview(current.preview_md || null);
            load();
          } else if (current.status === "failed") {
            clearInterval(pollRef.current!);
            setStatus(`Fehler: ${current.error || "Unbekannt"}`);
          } else if (attempts > 60) {
            // Stop polling after 90 seconds
            clearInterval(pollRef.current!);
            setStatus("Zeitüberschreitung — bitte Seite neu laden.");
          } else {
            setStatus(`Verarbeitung… (${attempts * 1.5}s)`);
          }
        } catch {
          clearInterval(pollRef.current!);
          setStatus("Verbindungsfehler beim Abruf des Status.");
        }
      }, 1500);
    } catch (err) {
      setStatus(`Upload fehlgeschlagen: ${err instanceof Error ? err.message : "Unbekannt"}`);
    }
  }

  async function remove(docId: string) {
    await apiFetch(`/api/ingest/document/${docId}`, { method: "DELETE" });
    load();
  }

  const statusOk = status.includes("✓");
  const statusErr = status.includes("Fehler") || status.includes("fehlgeschlagen") || status.includes("Zeitüberschreitung");

  return (
    <Shell>
      <div className="header">
        <div>
          <h1>Dokumentbibliothek</h1>
          <p>Upload, Statusverfolgung und Markdown-Vorschau.</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
          <div>
            <label>Klassifizierung</label>
            <select value={classification} onChange={(e) => setClassification(e.target.value)}>
              <option value="public">Öffentlich</option>
              <option value="internal">Intern</option>
            </select>
          </div>
          <div>
            <label>Fachbereich</label>
            <select value={department} onChange={(e) => setDepartment(e.target.value)}>
              {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        </div>

        <label className="dropzone">
          <input type="file" hidden onChange={(e) => upload(e.target.files?.[0])} />
          <div style={{ fontSize: 28, marginBottom: 10 }}>📄</div>
          <strong>Datei hier ablegen oder klicken</strong>
          <p>PDF, DOCX, XLSX, PPTX, Bilder, CSV, HTML</p>
        </label>
        {status && (
          <p style={{
            textAlign: "center", marginTop: 12, fontSize: "0.84rem",
            color: statusErr ? "var(--danger)" : statusOk ? "var(--success)" : "var(--cyan)",
          }}>
            {status}
          </p>
        )}
      </div>

      <div className="card">
        {documents.length === 0 ? (
          <p style={{ textAlign: "center", color: "var(--text-muted)", padding: "32px 0", fontSize: "0.875rem" }}>
            Noch keine Dokumente hochgeladen.
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Dateiname</th>
                <th>Fachbereich</th>
                <th>Klassifizierung</th>
                <th>Status</th>
                <th>Chunks</th>
                <th>Hochgeladen</th>
                <th>Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((doc) => (
                <tr key={doc.doc_id}>
                  <td style={{ fontWeight: 500 }}>{doc.filename}</td>
                  <td style={{ color: "var(--text-muted)", fontSize: "0.82rem" }}>{doc.department || "—"}</td>
                  <td>
                    <span className={`badge ${doc.classification === "internal" ? "violet" : "success"}`}>
                      {doc.classification === "internal" ? "Intern" : "Öffentlich"}
                    </span>
                  </td>
                  <td><span className="badge success">Bereit</span></td>
                  <td style={{ color: "var(--text-muted)" }}>{doc.chunk_count}</td>
                  <td className="mono">{doc.created_at ? new Date(doc.created_at).toLocaleDateString("de-DE") : "—"}</td>
                  <td>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button className="secondary" onClick={() => setPreview(JSON.stringify(doc, null, 2))} style={{ padding: "6px 12px", fontSize: "0.78rem" }}>
                        Vorschau
                      </button>
                      <button className="danger-btn" onClick={() => remove(doc.doc_id)} style={{ padding: "6px 12px", fontSize: "0.78rem" }}>
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
              <h3 style={{ fontSize: "1rem" }}>Markdown-Vorschau</h3>
              <button className="secondary" onClick={() => setPreview(null)} style={{ padding: "6px 14px" }}>Schließen</button>
            </div>
            <pre>{preview}</pre>
          </div>
        </div>
      )}
    </Shell>
  );
}
