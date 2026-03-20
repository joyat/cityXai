"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  ["/dashboard", "Dashboard"],
  ["/documents", "Dokumente"],
  ["/chat", "Fachchat"],
  ["/audit", "Audit"],
  ["/users", "Benutzer"]
];

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="layout">
      <aside className="sidebar">
        <h2>cityXai</h2>
        <p>Kommunaler Copilot</p>
        {items.map(([href, label]) => (
          <Link key={href} href={href} className={pathname.startsWith(href) ? "active" : ""}>
            {label}
          </Link>
        ))}
      </aside>
      <main className="content">{children}</main>
    </div>
  );
}
