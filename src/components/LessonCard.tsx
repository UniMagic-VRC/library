import { findCourse, findTerm, formatDate, lessonHref } from "../catalog";
import type { Catalog, Lesson } from "../types";
import { LessonAgeWarningPill, Pill, TagRow } from "./ui";

export function LessonCard({ catalog, lesson, showCourse = false }: { catalog: Catalog; lesson: Lesson; showCourse?: boolean }) {
  const course = findCourse(catalog, lesson.courseId);
  const term = findTerm(catalog, lesson.termId);
  const title = showCourse
    ? `${course?.title || ""} / 第${lesson.lessonNo}回 ${lesson.title}`
    : `第${lesson.lessonNo}回 ${lesson.title}`;

  return (
    <a href={lessonHref(lesson)} className="text-inherit no-underline">
      <article className="grid gap-3 rounded-lg border border-line bg-surface p-[18px] shadow-card">
        <div className="grid grid-cols-[1fr_auto] items-start gap-4 max-[760px]:grid-cols-1">
          <div>
            <h3 className="m-0 text-[19px] leading-[1.35]">{title}</h3>
            <p className="m-0 text-muted">{lesson.description || ""}</p>
            <div className="flex flex-wrap items-center gap-2">
              <LessonAgeWarningPill lastUpdated={lesson.lastUpdated} />
              {lesson.isLatestForCourseTerm ? <Pill>最新開講期</Pill> : <Pill className="warning">過去開講期</Pill>}
              <Pill>{term?.label || lesson.termId}</Pill>
              <Pill>最終更新 {formatDate(lesson.lastUpdated)}</Pill>
            </div>
          </div>
        </div>
        <TagRow tags={[...(course?.tags || []), ...lesson.tags]} />
      </article>
    </a>
  );
}
