"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";

const tabs = [
  ["/settings/server", "Server"],
  ["/settings/data", "Data & demo"],
  ["/settings/email", "Email"],
  ["/settings/ai", "Local AI"],
  ["/settings/branding", "Branding"],
  ["/settings/access", "Household access"],
] as const;

export default function SettingsLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return <div className="settings-workspace">
    <nav className="ledger-tabs settings-tabs" aria-label="Settings sections">
      {tabs.map(([href, label]) => <Link key={href} href={href} className={pathname === href ? "active" : ""} aria-current={pathname === href ? "page" : undefined}>{label}</Link>)}
    </nav>
    <div className="settings-tab-content">{children}</div>
  </div>;
}
