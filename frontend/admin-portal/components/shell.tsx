"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

// Parse JWT payload without validation (display only)
function parseToken(token: string): Record<string, any> | null {
  try {
    const [, payload] = token.split(".");
    return JSON.parse(Buffer.from(payload, "base64").toString());
  } catch {
    return null;
  }
}

function getRoles(token: string | null): string[] {
  if (!token) return [];
  const payload = parseToken(token);
  return payload?.realm_access?.roles ?? [];
}

const NAV = [
  { href: "/dashboard", label: "Dashboard",  icon: <GridIcon />,   roles: [] }, // visible to all
  { href: "/documents", label: "Dokumente",  icon: <FolderIcon />, roles: ["document_admin", "system_admin"] },
  { href: "/chat",      label: "Fachchat",   icon: <ChatIcon />,   roles: ["staff", "document_admin", "system_admin"] },
  { href: "/audit",     label: "Audit",      icon: <ShieldIcon />, roles: ["readonly_auditor", "system_admin"] },
  { href: "/users",     label: "Benutzer",   icon: <UsersIcon />,  roles: ["system_admin"] },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [roles, setRoles] = useState<string[]>([]);
  const [email, setEmail] = useState<string>("");

  useEffect(() => {
    const token = document.cookie
      .split("; ")
      .find((c) => c.startsWith("cityxai_token="))
      ?.split("=")[1];
    if (token) {
      const decoded = parseToken(decodeURIComponent(token));
      setRoles(decoded?.realm_access?.roles ?? []);
      setEmail(decoded?.email ?? decoded?.preferred_username ?? "");
    }
  }, []);

  function logout() {
    document.cookie = "cityxai_token=; Path=/; Max-Age=0; SameSite=Lax";
    router.push("/login");
  }

  const visibleNav = NAV.filter(({ roles: required }) =>
    required.length === 0 || required.some((r) => roles.includes(r))
  );

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <h2>cityXai</h2>
          <p>Kommunaler Copilot</p>
        </div>
        {visibleNav.map(({ href, label, icon }) => (
          <Link key={href} href={href} className={pathname.startsWith(href) ? "active" : ""}>
            {icon}
            {label}
          </Link>
        ))}

        <div style={{ flex: 1 }} />

        <div style={{
          marginTop: "auto", paddingTop: 16, borderTop: "1px solid var(--border)",
          display: "flex", flexDirection: "column", gap: 8,
        }}>
          {email && (
            <div style={{
              fontSize: "0.72rem", color: "var(--text-muted)",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              padding: "2px 4px",
            }}>
              {email}
            </div>
          )}
          <button
            onClick={logout}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              background: "transparent", border: "1px solid var(--border)",
              borderRadius: 8, padding: "7px 12px", cursor: "pointer",
              color: "var(--text-muted)", fontSize: "0.8rem", width: "100%",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(239,68,68,0.4)";
              (e.currentTarget as HTMLButtonElement).style.color = "#ef4444";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)";
              (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)";
            }}
          >
            <LogoutIcon />
            Abmelden
          </button>
        </div>
      </aside>
      <main className="content">{children}</main>
    </div>
  );
}

function GridIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
      <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16 17 21 12 16 7"/>
      <line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  );
}
