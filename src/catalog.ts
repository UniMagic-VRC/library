import type { Catalog, Course, Lesson, Term } from "./types";

export async function loadCatalog(): Promise<Catalog> {
  const response = await fetch("./data/catalog.json", { cache: "no-store" });
  if (!response.ok) {
    throw new Error("catalog.json を読み込めませんでした。生成と配置を確認してください。");
  }
  return response.json() as Promise<Catalog>;
}

export function lessonsForCourse(catalog: Catalog, courseId: string): Lesson[] {
  return catalog.lessons.filter((lesson) => lesson.courseId === courseId);
}

export function termsForLessons(catalog: Catalog, lessons: Lesson[]): Term[] {
  const termIds = new Set(lessons.map((lesson) => lesson.termId));
  return catalog.terms.filter((term) => termIds.has(term.id)).sort(compareTermDesc);
}

export function findCourse(catalog: Catalog, id: string | null): Course | undefined {
  return catalog.courses.find((course) => course.id === id);
}

export function findTerm(catalog: Catalog, id: string | null): Term | undefined {
  return catalog.terms.find((term) => term.id === id);
}

export function findLesson(catalog: Catalog, termId: string | null, courseId: string | null, lessonNo: string | null): Lesson | undefined {
  return catalog.lessons.find((lesson) =>
    lesson.termId === termId &&
    lesson.courseId === courseId &&
    lesson.lessonNo === normalizeLessonNo(lessonNo)
  );
}

export function compareTermDesc(a: Term, b: Term): number {
  return b.startsAt.localeCompare(a.startsAt);
}

export function compareLessonNo(a: Lesson, b: Lesson): number {
  return a.lessonNo.localeCompare(b.lessonNo, "ja", { numeric: true });
}

export function compareLessonVersion(catalog: Catalog, a: Lesson, b: Lesson): number {
  const termOrder = (findTerm(catalog, b.termId)?.startsAt || "").localeCompare(findTerm(catalog, a.termId)?.startsAt || "");
  if (termOrder !== 0) return termOrder;
  return compareLessonNo(a, b);
}

export function allTags(catalog: Catalog): string[] {
  const tags = new Set<string>();
  for (const course of catalog.courses) for (const tag of course.tags || []) tags.add(tag);
  for (const lesson of catalog.lessons) for (const tag of lesson.tags || []) tags.add(tag);
  return [...tags].sort((a, b) => a.localeCompare(b, "ja"));
}

export function selectedTagsMatch(catalog: Catalog, lesson: Lesson, selectedTags: Set<string>): boolean {
  if (!selectedTags.size) return true;
  const course = findCourse(catalog, lesson.courseId);
  const tags = new Set([...(course?.tags || []), ...(lesson.tags || [])]);
  return [...selectedTags].every((tag) => tags.has(tag));
}

export function textMatches(catalog: Catalog, lesson: Lesson, query: string): boolean {
  if (!query) return true;
  const course = findCourse(catalog, lesson.courseId);
  return [
    course?.title,
    course?.description,
    lesson.title,
    lesson.description,
    lesson.lessonNo,
    ...(course?.tags || []),
    ...(lesson.tags || [])
  ]
    .join(" ")
    .toLowerCase()
    .includes(query);
}

export function lessonHref(lesson: Lesson): string {
  return `./lesson.html?term=${encodeURIComponent(lesson.termId)}&course=${encodeURIComponent(lesson.courseId)}&lesson=${encodeURIComponent(lesson.lessonNo)}`;
}

export function normalizeLessonNo(value: string | null | undefined): string {
  if (!value) return "";
  const trimmed = String(value).trim();
  return /^\d+$/.test(trimmed) ? trimmed.padStart(2, "0") : trimmed;
}

export function lessonAgeWarningLabel(lastUpdated: string | undefined): string {
  const months = lessonAgeInMonths(lastUpdated);
  if (months === null) return "";
  if (months >= 24) return "2年以上";
  if (months >= 12) return "1年以上";
  if (months >= 6) return "6か月以上";
  return "";
}

export function lessonAgeWarningTone(
  lastUpdated: string | undefined,
): "default" | "warning" | "error" | null {
  const months = lessonAgeInMonths(lastUpdated);
  if (months === null || months < 6) return null;
  if (months >= 24) return "error";
  if (months >= 12) return "warning";
  return "default";
}

function lessonAgeInMonths(lastUpdated: string | undefined): number | null {
  const updated = parseLessonDate(lastUpdated);
  if (!updated) return null;
  const today = new Date();
  let months = (today.getFullYear() - updated.getFullYear()) * 12 + (today.getMonth() - updated.getMonth());
  if (today.getDate() < updated.getDate()) months -= 1;
  return Math.max(0, months);
}

function parseLessonDate(value: string | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00`);
  if (!Number.isNaN(parsed.getTime())) return parsed;
  const fallback = new Date(value);
  if (!Number.isNaN(fallback.getTime())) return fallback;
  return null;
}

export function formatDate(value: string | undefined): string {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ja-JP", { dateStyle: "medium" }).format(new Date(`${value}T00:00:00`));
}

export function formatBytes(value: number): string {
  if (!Number.isFinite(value)) return "";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

export function sameTags(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  return [...a].every((tag) => b.has(tag));
}
