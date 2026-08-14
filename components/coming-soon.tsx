import { EmptyState, Panel } from "./ui";

export default function ComingSoon({ title, description }: { title: string; description: string }) {
  return <div className="grid"><Panel><EmptyState title={title}>{description}</EmptyState></Panel></div>;
}
