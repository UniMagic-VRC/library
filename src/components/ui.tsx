import type { ReactNode } from "react";
import { lessonAgeWarningLabel, lessonAgeWarningTone } from "../catalog";
import { LinkIcon } from "lucide-react";

export function TagRow({ tags = [], hrefForTag }: { tags?: string[]; hrefForTag?: (tag: string) => string }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {[...new Set(tags)].map((tag) => (
        <Pill key={tag} tone="info" href={hrefForTag?.(tag)} showHrefIcon={false}>{tag}</Pill>
      ))}
    </div>
  );
}

export function Pill({
  children,
  tone = "default",
  href,
  showHrefIcon = true,
}: {
  children: ReactNode;
  tone?: "default" | "warning" | "error" | "info";
  href?: string;
  showHrefIcon?: boolean;
}) {
  const toneClass = tone === "warning"
    ? "border border-orange-300 bg-orange-50 text-warning"
    : tone === "error"
      ? "border border-red-300 bg-red-50 text-red-700"
      : tone === "info"
        ? "border border-accent-300 bg-accent-soft text-accent-strong"
        : "border border-line bg-surface-strong text-muted";

  const baseClass = `inline-flex min-h-7 items-center rounded-full px-2.5 py-1 text-[13px] font-[650] ${toneClass}`;

  if (href) return <a href={href} className={baseClass}>
    <LinkIcon className="mr-1 w-4 h-4" />
    {children}
  </a>;

  return <span className={baseClass}>{children}</span>;
}

export function LessonAgeWarningPill({ lastUpdated }: { lastUpdated: string | undefined }) {
  const label = lessonAgeWarningLabel(lastUpdated);
  const tone = lessonAgeWarningTone(lastUpdated);
  if (!label || !tone) return null;

  return (
    <Pill tone={tone}>
      最終更新から{label}経過しているため、情報が古い可能性があります。
    </Pill>
  );
}

export function Notice({ children, tone }: { children: ReactNode; tone?: "error" }) {
  const toneClass = tone === "error" ? "border-orange-200 bg-orange-50 text-warning" : "border-line bg-surface text-muted";
  return <div className={`rounded-lg border p-[18px] shadow-card ${toneClass}`}>{children}</div>;
}
