"use client";

import { FormEvent, useEffect, useState } from "react";

import { Shell } from "../../components/shell";
import { apiFetch } from "../../lib/api";

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
      method: "POST",
      body: JSON.stringify({ email: form.get("email"), password: form.get("password"), role: form.get("role") })
    });
    setMessage("Benutzer angelegt");
    event.currentTarget.reset();
    load();
  }

  async function remove(id: string) {
    await apiFetch(`/api/admin/users/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <Shell>
      <div className="header">
        <div><h1>Benutzerverwaltung</h1><p>Rollenbasierter Zugriff für Verwaltung und Revision.</p></div>
        <button className="secondary" onClick={() => setMessage("LDAP-Synchronisierung gestartet (Demo)")}>LDAP Sync</button>
      </div>
      <div className="grid cols-2">
        <div className="card">
          <h3>Benutzerliste</h3>
          <table>
            <thead><tr><th>E-Mail</th><th>Benutzername</th><th>Rollen</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>{user.email}</td>
                  <td>{user.username}</td>
                  <td>{(user.roles || []).map((role: string) => <span key={role} className="badge" style={{ marginRight: 6 }}>{role}</span>)}</td>
                  <td><span className={`badge ${user.enabled ? "success" : "warning"}`}>{user.enabled ? "Aktiv" : "Inaktiv"}</span></td>
                  <td><button onClick={() => remove(user.id)}>Löschen</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <form className="card" onSubmit={addUser}>
          <h3>Benutzer hinzufügen</h3>
          <label>E-Mail</label>
          <input name="email" required />
          <label>Passwort</label>
          <input name="password" defaultValue="Demo1234!" required />
          <label>Rolle</label>
          <select name="role" defaultValue="staff">
            <option value="staff">staff</option>
            <option value="document_admin">document_admin</option>
            <option value="readonly_auditor">readonly_auditor</option>
          </select>
          <button type="submit" style={{ marginTop: 16 }}>Benutzer anlegen</button>
          <p>{message}</p>
        </form>
      </div>
    </Shell>
  );
}
