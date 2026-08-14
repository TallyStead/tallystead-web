"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { apiRequest, clearSession, Me, savedConnection, Session } from "../lib/client";
import NavIcon, { NavIconName } from "./nav-icon";
import { AssistantProvider } from "./assistant-context";
import AssistantLauncher from "./assistant-launcher";
import { BrandIcon, BrandWordmark } from "./brand";

type AppContextValue = { serverUrl: string; session: Session; me: Me; refreshIdentity: () => Promise<void> };
type DemoStatus = { is_demo: boolean; seed: string | null; volume: string | null; reference_date: string | null };
const AppContext = createContext<AppContextValue | null>(null);

const navigation: Array<{ label: string; items: Array<[string, string, NavIconName]> }> = [
  { label: "Workspace", items: [["/overview", "Overview", "home"], ["/planner", "Cash Planner", "planner"], ["/transactions", "Transactions", "transactions"], ["/reports", "Reports", "reports"], ["/assistant", "Assistant", "assistant"], ["/bills", "Bills & calendar", "bills"], ["/review", "Review queue", "review"], ["/documents", "Documents", "documents"]] },
  { label: "Planning", items: [["/goals", "Plans & goals", "goals"]] },
  { label: "System", items: [["/settings/server", "Settings", "server"]] },
];

const pageTitles: Record<string, string> = {
  "/overview": "Overview", "/planner": "Cash Planner", "/transactions": "Transactions", "/reports": "Reports", "/assistant": "Assistant", "/bills": "Bills & calendar", "/review": "Review queue", "/documents": "Documents", "/goals": "Plans & goals", "/profile": "Your profile", "/settings/server": "Settings", "/settings/data": "Settings", "/settings/access": "Settings", "/settings/security": "Settings", "/settings/email": "Settings", "/settings/ai": "Settings", "/settings/branding": "Settings",
};

export function useAppSession() {
  const value = useContext(AppContext);
  if (!value) throw new Error("useAppSession must be used inside AppShell");
  return value;
}

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [connection, setConnection] = useState<{ serverUrl: string; session: Session } | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState("");
  const [demoStatus, setDemoStatus] = useState<DemoStatus | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarReady, setSidebarReady] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  async function loadIdentity(serverUrl: string, session: Session) {
    const [identity, demo] = await Promise.all([
      apiRequest<Me>(serverUrl, "/v1/auth/me", {}, session.access_token),
      apiRequest<DemoStatus>(serverUrl, "/v1/data/demo/status", {}, session.access_token),
    ]);
    setMe(identity);
    setDemoStatus(demo);
  }

  useEffect(() => {
    const saved = savedConnection();
    if (!saved?.session) { router.replace("/"); return; }
    setConnection({ serverUrl: saved.serverUrl, session: saved.session });
    void loadIdentity(saved.serverUrl, saved.session).catch(() => { clearSession(); router.replace("/"); });
  }, [router]);

  useEffect(() => {
    if (me && me.role !== "owner" && pathname.startsWith("/settings/")) router.replace("/overview");
  }, [me, pathname, router]);

  useEffect(() => {
    setSidebarCollapsed(window.localStorage.getItem("tallystead.sidebar-collapsed") === "true");
    setSidebarReady(true);
  }, []);

  useEffect(() => {
    if (sidebarReady) window.localStorage.setItem("tallystead.sidebar-collapsed", String(sidebarCollapsed));
  }, [sidebarCollapsed, sidebarReady]);

  useEffect(() => { setMobileNavOpen(false); }, [pathname]);

  useEffect(() => {
    if (!connection || !me) return;
    let lastActivity = Date.now();
    let locking = false;
    const markActivity = () => { lastActivity = Date.now(); };
    const checkIdle = () => {
      if (locking || Date.now() - lastActivity < me.session_idle_minutes * 60_000) return;
      locking = true;
      void apiRequest(connection.serverUrl, "/v1/auth/logout", { method: "POST" }, connection.session.access_token)
        .catch(() => undefined)
        .finally(() => { clearSession(); router.replace("/"); });
    };
    const events: Array<keyof WindowEventMap> = ["keydown", "pointerdown", "touchstart"];
    events.forEach((event) => window.addEventListener(event, markActivity, { passive: true }));
    const timer = window.setInterval(checkIdle, 60_000);
    return () => {
      events.forEach((event) => window.removeEventListener(event, markActivity));
      window.clearInterval(timer);
    };
  }, [connection, me, router]);

  const context = useMemo(() => connection && me ? { ...connection, me, refreshIdentity: () => loadIdentity(connection.serverUrl, connection.session) } : null, [connection, me]);
  if (!context) return <main className="loading"><BrandIcon className="loading-brand-icon" /><p>{error || "Connecting to your local server…"}</p></main>;
  const currentServerUrl = context.serverUrl;
  const currentAccessToken = context.session.access_token;

  function signOut() {
    void apiRequest(currentServerUrl, "/v1/auth/logout", { method: "POST" }, currentAccessToken)
      .catch(() => undefined)
      .finally(() => { clearSession(); router.replace("/"); });
  }
  const isOwner = context.me.role === "owner";
  const initials = context.me.display_name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "U";

  return <AppContext.Provider value={context}><AssistantProvider serverUrl={context.serverUrl} accessToken={context.session.access_token}><div className={`app-shell${sidebarCollapsed ? " sidebar-collapsed" : ""}${mobileNavOpen ? " mobile-nav-open" : ""}`}>
    <header className="mobile-app-bar"><button type="button" className="mobile-nav-toggle" aria-label={mobileNavOpen ? "Close navigation" : "Open navigation"} aria-expanded={mobileNavOpen} aria-controls="main-sidebar" onClick={() => setMobileNavOpen((value) => !value)}><span aria-hidden="true">{mobileNavOpen ? "×" : "☰"}</span></button><div className="mobile-app-brand"><BrandWordmark dark /></div></header>
    <button type="button" className="mobile-nav-backdrop" aria-label="Close navigation" tabIndex={mobileNavOpen ? 0 : -1} onClick={() => setMobileNavOpen(false)} />
    <aside className="sidebar" id="main-sidebar"><div className="sidebar-head"><div className="brand"><BrandIcon className="sidebar-brand-icon" dark /><span className="brand-copy"><BrandWordmark className="sidebar-wordmark" dark /><small>Your household finances, under your roof.</small></span></div><button type="button" className="sidebar-toggle" aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"} title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"} onClick={() => setSidebarCollapsed((value) => !value)}>{sidebarCollapsed ? "›" : "‹"}</button></div>
      <nav aria-label="Main navigation">{navigation.map((group) => <div className="nav-group" key={group.label}><span className="nav-label">{group.label}</span>{group.items.map(([href, label, icon]) => {
        if (!isOwner && href.startsWith("/settings/")) return null;
        const active = pathname === href || (href === "/settings/server" && pathname.startsWith("/settings/"));
        return <Link key={href} href={href} className={active ? "active" : ""} aria-label={label} aria-current={active ? "page" : undefined} title={sidebarCollapsed ? label : undefined}><span className="nav-icon"><NavIcon name={icon} /></span><span className="nav-text">{label}</span></Link>;
      })}</div>)}</nav>
      <div className="side-foot"><span className="server-copy"><b>Local server</b><br />{new URL(context.serverUrl).host}<br /></span><span className="pill green"><i className="online-dot" /> <span className="server-status">Online · local network</span></span></div>
      <details className="user-menu"><summary aria-label={`Account menu for ${context.me.display_name}`}><span className="user-avatar">{initials}</span><span className="user-menu-copy"><b>{context.me.display_name}</b><small>{context.me.role}</small></span><span className="user-chevron" aria-hidden="true">⌃</span></summary><div className="user-popover"><div className="user-popover-head"><b>{context.me.display_name}</b><small>{context.me.email}</small></div><Link href="/profile">Profile & security</Link>{isOwner && <Link href="/settings/access">Household access</Link>}<button type="button" onClick={signOut}>Sign out</button></div></details>
    </aside>
    <main className="main-content">{demoStatus?.is_demo && <div className="demo-household-banner"><div><b>Fictional demo household</b><span>All names, documents, and financial values are generated locally for demonstration.</span></div><Link href="/settings/data">Manage demo</Link></div>}<header className="page-header"><div><p className="eyebrow">{context.me.household_name}</p><h1>{pageTitles[pathname] ?? "Tallystead"}</h1></div></header>{error && <p className="status-message">{error}</p>}{children}</main><AssistantLauncher/>
  </div></AssistantProvider></AppContext.Provider>;
}
