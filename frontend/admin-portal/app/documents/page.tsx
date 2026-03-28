"use client";

import { useEffect, useRef, useState } from "react";
import { Shell } from "../../components/shell";
import { useI18n } from "../../lib/i18n";
import { apiFetch } from "../../lib/api";

const DEPARTMENTS = [
  "Bürgerservice", "Standesamt", "Bauordnung", "Kämmerei",
  "Stadtplanung", "Ordnungsamt", "Sozialamt", "Schulverwaltung",
  "IT & Digitalisierung", "Personalamt",
];

const DEPARTMENT_LABELS: Record<string, { de: string; en: string }> = {
  "Bürgerservice": { de: "Bürgerservice", en: "Citizen Services" },
  "Standesamt": { de: "Standesamt", en: "Registry Office" },
  "Bauordnung": { de: "Bauordnung", en: "Building Control" },
  "Kämmerei": { de: "Kämmerei", en: "Treasury" },
  "Stadtplanung": { de: "Stadtplanung", en: "Urban Planning" },
  "Ordnungsamt": { de: "Ordnungsamt", en: "Public Order Office" },
  "Sozialamt": { de: "Sozialamt", en: "Social Services" },
  "Schulverwaltung": { de: "Schulverwaltung", en: "School Administration" },
  "IT & Digitalisierung": { de: "IT & Digitalisierung", en: "IT & Digitalization" },
  "Personalamt": { de: "Personalamt", en: "HR Office" },
};

export default function DocumentsPage() {
  const { language } = useI18n();
  const [documents, setDocuments] = useState<any[]>([]);
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [classification, setClassification] = useState("public");
  const [department, setDepartment] = useState(DEPARTMENTS[0]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const trDepartment = (value: string) => DEPARTMENT_LABELS[value]?.[language] || value;

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
    setStatus(language === "de" ? "Upload läuft…" : "Uploading…");
    const form = new FormData();
    form.append("file", file);
    form.append("classification", classification);
    form.append("department", department);
    try {
      const response = await apiFetch("/api/ingest/upload", { method: "POST", body: form });
      const job = await response.json();
      if (!job.job_id) throw new Error(language === "de" ? "Keine Job-ID erhalten." : "No job ID returned.");
      setStatus(language === "de" ? "Verarbeitung gestartet…" : "Processing started…");

      let attempts = 0;
      pollRef.current = setInterval(async () => {
        attempts++;
        try {
          const current = await apiFetch(`/api/ingest/status/${job.job_id}`).then((r) => r.json());
          if (current.status === "ready") {
            clearInterval(pollRef.current!);
            setStatus(language === "de" ? "Bereit ✓" : "Ready ✓");
            setPreview(current.preview_md || null);
            load();
          } else if (current.status === "failed") {
            clearInterval(pollRef.current!);
            setStatus(`${language === "de" ? "Fehler" : "Error"}: ${current.error || (language === "de" ? "Unbekannt" : "Unknown")}`);
          } else if (attempts > 60) {
            // Stop polling after 90 seconds
            clearInterval(pollRef.current!);
            setStatus(language === "de" ? "Zeitüberschreitung — bitte Seite neu laden." : "Timed out. Please reload the page.");
          } else {
            setStatus(`${language === "de" ? "Verarbeitung" : "Processing"}… (${attempts * 1.5}s)`);
          }
        } catch {
          clearInterval(pollRef.current!);
          setStatus(language === "de" ? "Verbindungsfehler beim Abruf des Status." : "Connection error while fetching status.");
        }
      }, 1500);
    } catch (err) {
      setStatus(`${language === "de" ? "Upload fehlgeschlagen" : "Upload failed"}: ${err instanceof Error ? err.message : (language === "de" ? "Unbekannt" : "Unknown")}`);
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
          <h1>{language === "de" ? "Dokumentbibliothek" : "Document Library"}</h1>
          <p>{language === "de" ? "Upload, Statusverfolgung und Markdown-Vorschau." : "Upload, status tracking and markdown preview."}</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
          <div>
            <label>{language === "de" ? "Klassifizierung" : "Classification"}</label>
            <select value={classification} onChange={(e) => setClassification(e.target.value)}>
              <option value="public">{language === "de" ? "Öffentlich" : "Public"}</option>
              <option value="internal">{language === "de" ? "Intern" : "Internal"}</option>
            </select>
          </div>
          <div>
            <label>{language === "de" ? "Fachbereich" : "Department"}</label>
            <select value={department} onChange={(e) => setDepartment(e.target.value)}>
              {DEPARTMENTS.map((d) => <option key={d} value={d}>{trDepartment(d)}</option>)}
            </select>
          </div>
        </div>

        <label className="dropzone">
          <input type="file" hidden onChange={(e) => upload(e.target.files?.[0])} />
          <div style={{ fontSize: 28, marginBottom: 10 }}>📄</div>
          <strong>{language === "de" ? "Datei hier ablegen oder klicken" : "Drop file here or click"}</strong>
          <p>{language === "de" ? "PDF, DOCX, XLSX, PPTX, Bilder, CSV, HTML" : "PDF, DOCX, XLSX, PPTX, images, CSV, HTML"}</p>
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
            {language === "de" ? "Noch keine Dokumente hochgeladen." : "No documents uploaded yet."}
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>{language === "de" ? "Dateiname" : "Filename"}</th>
                <th>{language === "de" ? "Fachbereich" : "Department"}</th>
                <th>{language === "de" ? "Klassifizierung" : "Classification"}</th>
                <th>{language === "de" ? "Status" : "Status"}</th>
                <th>{language === "de" ? "Segmente" : "Chunks"}</th>
                <th>{language === "de" ? "Hochgeladen" : "Uploaded"}</th>
                <th>{language === "de" ? "Aktionen" : "Actions"}</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((doc) => (
                <tr key={doc.doc_id}>
                  <td style={{ fontWeight: 500 }}>{doc.filename}</td>
                  <td style={{ color: "var(--text-muted)", fontSize: "0.82rem" }}>{doc.department ? trDepartment(doc.department) : "—"}</td>
                  <td>
                    <span className={`badge ${doc.classification === "internal" ? "violet" : "success"}`}>
                      {doc.classification === "internal" ? (language === "de" ? "Intern" : "Internal") : (language === "de" ? "Öffentlich" : "Public")}
                    </span>
                  </td>
                  <td><span className="badge success">{language === "de" ? "Bereit" : "Ready"}</span></td>
                  <td style={{ color: "var(--text-muted)" }}>{doc.chunk_count}</td>
                  <td className="mono">{doc.created_at ? new Date(doc.created_at).toLocaleDateString(language === "de" ? "de-DE" : "en-GB") : "—"}</td>
                  <td>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button className="secondary" onClick={() => setPreview(JSON.stringify(doc, null, 2))} style={{ padding: "6px 12px", fontSize: "0.78rem" }}>
                        {language === "de" ? "Vorschau" : "Preview"}
                      </button>
                      <button className="danger-btn" onClick={() => remove(doc.doc_id)} style={{ padding: "6px 12px", fontSize: "0.78rem" }}>
                        {language === "de" ? "Löschen" : "Delete"}
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
              <h3 style={{ fontSize: "1rem" }}>{language === "de" ? "Markdown-Vorschau" : "Markdown Preview"}</h3>
              <button className="secondary" onClick={() => setPreview(null)} style={{ padding: "6px 14px" }}>{language === "de" ? "Schließen" : "Close"}</button>
            </div>
            <pre>{preview}</pre>
          </div>
        </div>
      )}
    </Shell>
  );
}
