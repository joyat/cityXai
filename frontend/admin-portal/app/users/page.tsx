"use client";

import { FormEvent, useEffect, useState } from "react";
import { Shell } from "../../components/shell";
import { useI18n } from "../../lib/i18n";
import { apiFetch } from "../../lib/api";

const ROLE_COLORS: Record<string, string> = {
  system_admin:      "danger",
  document_admin:    "",
  staff:             "success",
  readonly_auditor:  "violet",
  citizen:           "warning",
};

const ROLE_LABELS: Record<string, { de: string; en: string }> = {
  system_admin: { de: "Systemadmin", en: "System admin" },
  document_admin: { de: "Dokumentenadmin", en: "Document admin" },
  staff: { de: "Sachbearbeitung", en: "Staff" },
  readonly_auditor: { de: "Revisor", en: "Auditor" },
  citizen: { de: "Bürger", en: "Citizen" },
};

export default function UsersPage() {
  const { language } = useI18n();
  const [users, setUsers] = useState<any[]>([]);
  const [message, setMessage] = useState("");
  const trRole = (value: string) => ROLE_LABELS[value]?.[language] || value;

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
    setMessage(language === "de" ? "Benutzer erfolgreich angelegt." : "User created successfully.");
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
          <h1>{language === "de" ? "Benutzerverwaltung" : "User Management"}</h1>
          <p>{language === "de" ? "Rollenbasierter Zugriff für Verwaltung, Bürger und Revision." : "Role-based access for administration, citizens, and audit."}</p>
        </div>
        <div style={{ position:"relative", display:"inline-block" }}>
          <button
            className="secondary"
            style={{ padding:"9px 16px", opacity:0.5, cursor:"not-allowed" }}
            title={language === "de" ? "LDAP-Synchronisierung ist in der nächsten Version verfügbar" : "LDAP sync will be available in the next version"}
            disabled
          >
            {language === "de" ? "LDAP-Sync" : "LDAP Sync"}
            <span style={{
              marginLeft:8, fontSize:"0.65rem", padding:"1px 6px",
              borderRadius:"10px", background:"rgba(124,58,237,0.25)",
              color:"#a78bfa", fontWeight:600, letterSpacing:"0.04em",
            }}>{language === "de" ? "Demnächst" : "Soon"}</span>
          </button>
        </div>
      </div>

      <div className="grid cols-2">
        <div className="card">
          <h3 style={{ marginBottom:14 }}>{language === "de" ? "Benutzerliste" : "User List"}</h3>
          {users.length === 0 ? (
            <p style={{ color:"var(--text-muted)", fontSize:"0.875rem", padding:"16px 0" }}>{language === "de" ? "Keine Benutzer gefunden." : "No users found."}</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>{language === "de" ? "E-Mail" : "Email"}</th>
                  <th>{language === "de" ? "Rollen" : "Roles"}</th>
                  <th>{language === "de" ? "Status" : "Status"}</th>
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
                          <span key={role} className={`badge ${ROLE_COLORS[role] || ""}`} style={{ fontSize:"0.65rem" }}>{trRole(role)}</span>
                        ))}
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${user.enabled ? "success" : "warning"}`}>
                        {user.enabled ? (language === "de" ? "Aktiv" : "Active") : (language === "de" ? "Inaktiv" : "Inactive")}
                      </span>
                    </td>
                    <td>
                      <button className="danger-btn" onClick={() => remove(user.id)} style={{ padding:"5px 12px", fontSize:"0.78rem" }}>
                        {language === "de" ? "Entfernen" : "Remove"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <form className="card" onSubmit={addUser} style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <h3 style={{ marginBottom:0 }}>{language === "de" ? "Benutzer hinzufügen" : "Add User"}</h3>
          <div>
            <label>{language === "de" ? "E-Mail-Adresse" : "Email address"}</label>
            <input name="email" type="email" placeholder={language === "de" ? "benutzer@kommune.de" : "user@municipality.de"} required />
          </div>
          <div>
            <label>{language === "de" ? "Passwort" : "Password"}</label>
            <input name="password" type="password" placeholder={language === "de" ? "Temporäres Passwort" : "Temporary password"} required />
          </div>
          <div>
            <label>{language === "de" ? "Rolle" : "Role"}</label>
            <select name="role" defaultValue="staff">
              <option value="staff">{trRole("staff")}</option>
              <option value="document_admin">{trRole("document_admin")}</option>
              <option value="readonly_auditor">{trRole("readonly_auditor")}</option>
              <option value="system_admin">{trRole("system_admin")}</option>
              <option value="citizen">{trRole("citizen")}</option>
            </select>
          </div>
          <button type="submit" style={{ justifyContent:"center", marginTop:4 }}>{language === "de" ? "Benutzer anlegen" : "Create user"}</button>
          {message && <p className="text-success">{message}</p>}
        </form>
      </div>
    </Shell>
  );
}
