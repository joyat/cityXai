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
    const form = new FormData();
    form.append("file", file);
    form.append("classification", "public");
    form.append("department", "Bürgerservice");
    const response = await apiFetch("/api/ingest/upload", { method: "POST", body: form });
    const job = await response.json();
    setStatus(`Upload gestartet: ${job.job_id}`);
    const poll = setInterval(async () => {
      const current = await apiFetch(`/api/ingest/status/${job.job_id}`).then((r) => r.json());
      setStatus(`Status: ${current.status}`);
      if (current.status !== "processing") {
        clearInterval(poll);
        setPreview(current.preview_md);
        load();
      }
    }, 1500);
  }

  async function remove(docId: string) {
    await apiFetch(`/api/ingest/document/${docId}`, { method: "DELETE" });
    load();
  }

  return (
    <Shell>
      <div className="header">
        <div><h1>Dokumentbibliothek</h1><p>Upload, Statusüberwachung und Markdown-Vorschau.</p></div>
      </div>
      <div className="card" style={{ marginBottom: 16 }}>
        <label className="dropzone">
          <input type="file" hidden onChange={(e) => upload(e.target.files?.[0])} />
          <strong>Datei hier ablegen oder klicken</strong>
          <p>Unterstützt PDF, DOCX, XLSX, PPTX, Bilder, CSV und HTML.</p>
        </label>
        <p>{status}</p>
      </div>
      <div className="card">
        <table>
          <thead>
            <tr><th>Name</th><th>Typ</th><th>Status</th><th>Chunks</th><th>Upload</th><th>Aktion</th></tr>
          </thead>
          <tbody>
            {documents.map((doc) => (
              <tr key={doc.doc_id}>
                <td>{doc.filename}</td>
                <td>{doc.content_type}</td>
                <td><span className="badge success">Bereit</span></td>
                <td>{doc.chunk_count}</td>
                <td>{doc.created_at}</td>
                <td>
                  <button className="secondary" onClick={() => setPreview(JSON.stringify(doc, null, 2))}>Preview MD</button>
                  <button style={{ marginLeft: 8 }} onClick={() => remove(doc.doc_id)}>Löschen</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {preview ? (
        <div className="modal" onClick={() => setPreview(null)}>
          <div onClick={(e) => e.stopPropagation()}>
            <div className="header"><h3>Markdown-Vorschau</h3><button onClick={() => setPreview(null)}>Schließen</button></div>
            <pre style={{ whiteSpace: "pre-wrap" }}>{preview}</pre>
          </div>
        </div>
      ) : null}
    </Shell>
  );
}
