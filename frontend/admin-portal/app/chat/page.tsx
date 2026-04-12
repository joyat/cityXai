"use client";

import { FormEvent, useState } from "react";
import { Shell } from "../../components/shell";
import { useI18n } from "../../lib/i18n";
import { apiFetch } from "../../lib/api";

export default function ChatPage() {
  const { language } = useI18n();
  const [messages, setMessages] = useState<any[]>([]);
  const [devMode, setDevMode] = useState(false);
  const [mode, setMode] = useState("hybrid");
  const [loading, setLoading] = useState(false);

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const query = String(form.get("query") || "").trim();
    if (!query || loading) return;
    setLoading(true);
    const nextHistory = [...messages, { role:"user", content:query }].map((msg) => ({
      role: String(msg.role ?? ""),
      content: String(msg.content ?? ""),
    }));
    setMessages((cur) => [...cur, { role:"user", content:query }]);
    event.currentTarget.reset();
    try {
      const response = await apiFetch("/api/chat/query", {
        method: "POST",
        headers: { "X-Dev-Mode": String(devMode) },
        body: JSON.stringify({
          query,
          namespace:"public",
          retrieval_mode:mode,
          conversation_history:nextHistory,
          response_language: language,
        }),
      }).then((r) => r.json());
      setMessages((cur) => [...cur, {
        role:"assistant", content:response.answer,
        sources:response.sources, scores:response.retrieval_scores,
        chunks:response.retrieved_chunks, expanded:response.expanded_queries,
        confidence:response.confidence, flagged:response.flagged,
        latency:response.latency_ms,
      }]);
    } catch {
      setMessages((cur) => [...cur, { role:"assistant", content: language === "de" ? "Fehler beim Abrufen der Antwort." : "Error while fetching the answer." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Shell>
      <div className="header">
        <div>
          <h1>{language === "de" ? "Fachchat" : "Expert Chat"}</h1>
          <p>{language === "de" ? "Hybrid-RAG mit Quellenbelegen, Konfidenz-Scoring und Dev-Modus." : "Hybrid RAG with sources, confidence scoring, and dev mode."}</p>
        </div>
        <div style={{ display:"flex", gap:10, alignItems:"center", flexWrap:"wrap" }}>
          <label style={{ display:"flex", alignItems:"center", gap:6, fontSize:"0.82rem", color:"var(--text-muted)", cursor:"pointer", margin:0 }}>
            <input type="checkbox" checked={devMode} onChange={() => setDevMode(!devMode)} style={{ width:"auto", accentColor:"var(--cyan)" }} />
            {language === "de" ? "Dev-Modus" : "Dev mode"}
          </label>
          <select value={mode} onChange={(e) => setMode(e.target.value)} style={{ width:"auto", padding:"7px 12px", fontSize:"0.82rem" }}>
            <option value="hybrid">Hybrid</option>
            <option value="dense">{language === "de" ? "Nur Dense" : "Dense-only"}</option>
          </select>
        </div>
      </div>

      <div className="card">
        <div className="messages">
          {messages.length === 0 && (
            <div style={{ textAlign:"center", color:"var(--text-faint)", padding:"40px 0", fontSize:"0.875rem" }}>
              {language === "de" ? "Stellen Sie eine Frage zur kommunalen Akte…" : "Ask a question about the municipal file…"}
            </div>
          )}
          {messages.map((msg, idx) => (
            <div key={idx} className={`message${msg.role === "user" ? " user" : ""}`}>
              <strong>{msg.role === "user" ? (language === "de" ? "Sie" : "You") : "cityXai"}</strong>
              <p style={{ margin:0, lineHeight:1.65 }}>{msg.content}</p>

              {msg.flagged && (
                <div style={{ marginTop:8, padding:"6px 10px", background:"var(--warning-dim)", border:"1px solid rgba(245,158,11,0.2)", borderRadius:"8px", fontSize:"0.75rem", color:"var(--warning)" }}>
                  ⚠ {language === "de" ? "Niedrige Konfidenz — Antwort mit Unsicherheit behaftet" : "Low confidence — answer is uncertain"}
                </div>
              )}

              {msg.sources?.length > 0 && (
                <div style={{ marginTop:10 }}>
                  <p style={{ fontSize:"0.72rem", fontWeight:600, color:"var(--text-muted)", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:5 }}>{language === "de" ? "Quellen" : "Sources"}</p>
                  <ol style={{ margin:"0 0 0 16px", fontSize:"0.78rem", color:"var(--text-muted)", lineHeight:1.7 }}>
                    {msg.sources.map((src: any, i: number) => (
                      <li key={i}>
                        {src.filename}
                        {src.section_heading && <span style={{ color:"var(--text-faint)" }}> · {src.section_heading}</span>}
                        {msg.scores?.[i] != null && <span className="badge" style={{ marginLeft:6, fontSize:"0.65rem" }}>Score {msg.scores[i].toFixed(3)}</span>}
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {devMode && msg.expanded?.length > 0 && (
                <div className="dev-panel">
                  <p style={{ marginBottom:6, color:"var(--cyan)", fontSize:"0.7rem", fontWeight:600 }}>{language === "de" ? "QUERY-ERWEITERUNG" : "QUERY EXPANSION"}</p>
                  {msg.expanded.map((q: string, i: number) => <div key={i}>→ {q}</div>)}
                  {msg.latency && <div style={{ marginTop:6, color:"var(--text-faint)" }}>{language === "de" ? "Latenz" : "Latency"}: {msg.latency} ms</div>}
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div className="message">
              <strong>cityXai</strong>
              <p style={{ color:"var(--text-muted)", margin:0 }}>{language === "de" ? "Analysiere…" : "Analyzing…"}</p>
            </div>
          )}
        </div>

        <form onSubmit={send} style={{ marginTop:16, display:"grid", gap:10 }}>
          <textarea name="query" rows={3} placeholder={language === "de" ? "Frage zur kommunalen Akte stellen…" : "Ask a question about the municipal file…"} style={{ resize:"vertical" }} />
          <button type="submit" disabled={loading} style={{ justifyContent:"center" }}>
            {loading ? (language === "de" ? "Wird verarbeitet…" : "Processing…") : (language === "de" ? "Anfrage senden" : "Send query")}
          </button>
        </form>
      </div>
    </Shell>
  );
}
