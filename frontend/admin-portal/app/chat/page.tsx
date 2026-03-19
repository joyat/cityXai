"use client";

import { FormEvent, useState } from "react";

import { Shell } from "../../components/shell";
import { apiFetch } from "../../lib/api";

export default function ChatPage() {
  const [messages, setMessages] = useState<any[]>([]);
  const [devMode, setDevMode] = useState(true);
  const [mode, setMode] = useState("hybrid");

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const query = String(form.get("query") || "");
    if (!query) return;
    setMessages((current) => [...current, { role: "user", content: query }]);
    const response = await apiFetch("/api/chat/query", {
      method: "POST",
      headers: { "X-Dev-Mode": String(devMode) },
      body: JSON.stringify({ query, namespace: "public", retrieval_mode: mode, conversation_history: messages })
    }).then((r) => r.json());
    setMessages((current) => [...current, { role: "assistant", content: response.answer, sources: response.sources, scores: response.retrieval_scores, chunks: response.retrieved_chunks }]);
    event.currentTarget.reset();
  }

  return (
    <Shell>
      <div className="header">
        <div><h1>Fachchat</h1><p>Hybrid-RAG mit Quellenbelegen und optionalem Dev-Modus.</p></div>
        <div style={{ display: "flex", gap: 12 }}>
          <label><input type="checkbox" checked={devMode} onChange={() => setDevMode(!devMode)} /> Dev-Modus</label>
          <select value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="hybrid">Hybrid</option>
            <option value="dense">Dense-only</option>
          </select>
        </div>
      </div>
      <div className="card">
        <div className="messages">
          {messages.map((message, index) => (
            <div key={index} className={`message ${message.role === "user" ? "user" : ""}`}>
              <strong>{message.role === "user" ? "Sie" : "PadeRoBot+"}</strong>
              <p>{message.content}</p>
              {message.sources?.length ? (
                <div>
                  <strong>Quellen</strong>
                  <ol>
                    {message.sources.map((source: any, idx: number) => (
                      <li key={idx}>{source.filename} ({source.section_heading}) {message.scores?.[idx] ? `- Score ${message.scores[idx]}` : ""}</li>
                    ))}
                  </ol>
                </div>
              ) : null}
            </div>
          ))}
        </div>
        <form onSubmit={send} style={{ marginTop: 16, display: "grid", gap: 12 }}>
          <textarea name="query" rows={4} placeholder="Frage zur kommunalen Akte stellen" />
          <button type="submit">Anfrage senden</button>
        </form>
      </div>
    </Shell>
  );
}
