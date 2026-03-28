"use client";

import { FormEvent, useEffect, useState } from "react";
import { Shell } from "../../components/shell";
import { apiFetch } from "../../lib/api";

const ROLE_COLORS: Record<string, string> = {
  system_admin:      "danger",
  document_admin:    "",
  staff:             "success",
  readonly_auditor:  "violet",
  citizen:           "warning",
};

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [message, setMessage] = useState("");

  async function load() {
    const data = await apiFetch("/api/admin/users").then((r) => r.json());
    setUsers(data.users || []);
  }

  useEffect(() => { load(); }, []);

  async function addUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await apiFetch("/api/admin/users", {
      method:"POST",
      body: JSON.stringify({ email: form.get("email"), password: form.get("password"), role: form.get("role") }),
    });
    setMessage("Benutzer erfolgreich angelegt.");
    event.currentTarget.reset();
    load();
  }

  async function remove(id: string) {
    await apiFetch(`/api/admin/users/${id}`, { method:"DELETE" });
    load();
  }

  return (
    <Shell>
      <div className="header">
        <div>
          <h1>Benutzerverwaltung</h1>
          <p>Rollenbasierter Zugriff für Verwaltung, Bürger und Revision.</p>
        </div>
        <div style={{ position:"relative", display:"inline-block" }}>
          <button
            className="secondary"
            style={{ padding:"9px 16px", opacity:0.5, cursor:"not-allowed" }}
            title="LDAP-Synchronisierung ist in der nächsten Version verfügbar"
            disabled
          >
            LDAP Sync
            <span style={{
              marginLeft:8, fontSize:"0.65rem", padding:"1px 6px",
              borderRadius:"10px", background:"rgba(124,58,237,0.25)",
              color:"#a78bfa", fontWeight:600, letterSpacing:"0.04em",
            }}>Demnächst</span>
          </button>
        </div>
      </div>

      <div className="grid cols-2">
        <div className="card">
          <h3 style={{ marginBottom:14 }}>Benutzerliste</h3>
          {users.length === 0 ? (
            <p style={{ color:"var(--text-muted)", fontSize:"0.875rem", padding:"16px 0" }}>Keine Benutzer gefunden.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>E-Mail</th>
                  <th>Rollen</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td style={{ fontSize:"0.84rem" }}>{user.email || user.username}</td>
                    <td>
                      <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
                        {(user.roles || []).map((role: string) => (
                          <span key={role} className={`badge ${ROLE_COLORS[role] || ""}`} style={{ fontSize:"0.65rem" }}>{role}</span>
                        ))}
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${user.enabled ? "success" : "warning"}`}>
                        {user.enabled ? "Aktiv" : "Inaktiv"}
                      </span>
                    </td>
                    <td>
                      <button className="danger-btn" onClick={() => remove(user.id)} style={{ padding:"5px 12px", fontSize:"0.78rem" }}>
                        Entfernen
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <form className="card" onSubmit={addUser} style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <h3 style={{ marginBottom:0 }}>Benutzer hinzufügen</h3>
          <div>
            <label>E-Mail-Adresse</label>
            <input name="email" type="email" placeholder="benutzer@kommune.de" required />
          </div>
          <div>
            <label>Passwort</label>
            <input name="password" type="password" placeholder="Temporäres Passwort" required />
          </div>
          <div>
            <label>Rolle</label>
            <select name="role" defaultValue="staff">
              <option value="staff">staff</option>
              <option value="document_admin">document_admin</option>
              <option value="readonly_auditor">readonly_auditor</option>
              <option value="system_admin">system_admin</option>
              <option value="citizen">citizen</option>
            </select>
          </div>
          <button type="submit" style={{ justifyContent:"center", marginTop:4 }}>Benutzer anlegen</button>
          {message && <p className="text-success">{message}</p>}
        </form>
      </div>
    </Shell>
  );
}
