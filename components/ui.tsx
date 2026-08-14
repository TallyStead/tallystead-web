import { ReactNode } from "react";

export function Panel({ children, span = 12, className = "" }: { children: ReactNode; span?: number; className?: string }) {
  return <section className={`panel span-${span} ${className}`}>{children}</section>;
}

export function Pill({ children, tone = "green" }: { children: ReactNode; tone?: "green" | "amber" | "red" | "blue" }) {
  return <span className={`pill ${tone}`}>{children}</span>;
}

export function Notice({ title, children }: { title: string; children: ReactNode }) {
  return <div className="notice"><strong>{title}</strong><span className="muted">{children}</span></div>;
}

export function EmptyState({ title, children }: { title: string; children: ReactNode }) {
  return <div className="empty"><strong>{title}</strong><p>{children}</p></div>;
}
