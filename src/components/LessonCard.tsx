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
    <a href={lessonHref(lesson)} className="card-link">
      <article className="lesson-item">
        <div className="lesson-item-header">
          <div>
            <h3>{title}</h3>
            <p>{lesson.description || ""}</p>
            <div className="meta-row">
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
