type NavIconName = "home" | "planner" | "transactions" | "reports" | "assistant" | "bills" | "review" | "documents" | "goals" | "server" | "email" | "ai" | "branding" | "data";

const paths: Record<NavIconName, React.ReactNode> = {
  home: <><path d="m3 11 9-8 9 8" /><path d="M5 10v10h14V10" /><path d="M9 20v-6h6v6" /></>,
  planner: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M7 2v4M17 2v4M3 9h18M8 13h3M8 17h7" /></>,
  transactions: <><path d="M4 7h15M15 3l4 4-4 4M20 17H5M9 13l-4 4 4 4" /></>,
  reports: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>,
  assistant: <><path d="m12 3 1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3Z"/><path d="m19 16 .7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7L19 16Z"/></>,
  bills: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  review: <><path d="M4 12.5 9 17l11-11" /></>,
  documents: <><path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 12h6M9 16h6"/></>,
  goals: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></>,
  server: <><rect x="4" y="3" width="16" height="7" rx="2" /><rect x="4" y="14" width="16" height="7" rx="2" /><path d="M8 6.5h.01M8 17.5h.01" /></>,
  email: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m4 7 8 6 8-6" /></>,
  ai: <><path d="m12 3 1.2 4.1L17 9l-3.8 1.9L12 15l-1.2-4.1L7 9l3.8-1.9L12 3Z" /><path d="m18.5 15 .7 2.3 2.3.7-2.3.7-.7 2.3-.7-2.3-2.3-.7 2.3-.7.7-2.3Z" /></>,
  branding: <><path d="M12 3 4 8v8l8 5 8-5V8l-8-5Z" /><path d="m4 8 8 5 8-5M12 13v8" /></>,
  data: <><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v7c0 1.7 3.6 3 8 3s8-1.3 8-3V5" /><path d="M4 12v7c0 1.7 3.6 3 8 3s8-1.3 8-3v-7" /></>,
};

export default function NavIcon({ name }: { name: NavIconName }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

export type { NavIconName };
