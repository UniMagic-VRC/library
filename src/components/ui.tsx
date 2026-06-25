import type { ReactNode } from "react";
import { lessonAgeWarningLabel } from "../catalog";

export function TagRow({ tags = [] }: { tags?: string[] }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {[...new Set(tags)].map((tag) => (
        <span key={tag} className="inline-flex min-h-7 items-center rounded-full bg-accent-soft px-2.5 py-1 text-[13px] font-[650] text-accent-strong">
          {tag}
        </span>
      ))}
    </div>
  );
}

export function Pill({ children, className }: { children: ReactNode; className?: string }) {
  const toneClass = className === "warning"
    ? "border border-orange-300 bg-orange-50 text-warning"
    : "bg-surface-strong text-muted";
  return <span className={`inline-flex min-h-7 items-center rounded-full px-2.5 py-1 text-[13px] font-[650] ${toneClass}`}>{children}</span>;
}

export function LessonAgeWarningPill({ lastUpdated }: { lastUpdated: string | undefined }) {
  const label = lessonAgeWarningLabel(lastUpdated);
  if (!label) return null;
  return (
    <span className="inline-flex min-h-7 items-center rounded-full border border-orange-300 bg-orange-50 px-2.5 py-1 text-[13px] font-[650] text-warning">
      最終更新から{label}経過しているため、情報が古い可能性があります。
    </span>
  );
}

export function Notice({ children, tone }: { children: ReactNode; tone?: "error" }) {
  const toneClass = tone === "error" ? "border-orange-200 bg-orange-50 text-warning" : "border-line bg-surface text-muted";
  return <div className={`rounded-lg border p-[18px] shadow-card ${toneClass}`}>{children}</div>;
}
