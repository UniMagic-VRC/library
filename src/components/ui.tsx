import type { ReactNode } from "react";
import { lessonAgeWarningLabel } from "../catalog";

export function TagRow({ tags = [] }: { tags?: string[] }) {
  return (
    <div className="tag-row">
      {[...new Set(tags)].map((tag) => <span key={tag} className="tag">{tag}</span>)}
    </div>
  );
}

export function Pill({ children }: { children: ReactNode }) {
  return <span className="pill">{children}</span>;
}

export function LessonAgeWarningPill({ lastUpdated }: { lastUpdated: string | undefined }) {
  const label = lessonAgeWarningLabel(lastUpdated);
  if (!label) return null;
  return <span className="pill warning">最終更新から{label}更新されておらず、情報が古い可能性があります。</span>;
}

export function Notice({ children, tone }: { children: ReactNode; tone?: "error" }) {
  return <div className={tone === "error" ? "notice error" : "notice"}>{children}</div>;
}
