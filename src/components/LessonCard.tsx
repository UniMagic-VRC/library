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
    <article className="lesson-item">
      <div className="lesson-item-header">
        <div>
          <h3>{title}</h3>
          <p>{lesson.description || ""}</p>
          <div className="meta-row">
            <Pill>{term?.label || lesson.termId}</Pill>
            <Pill>最終更新 {formatDate(lesson.lastUpdated)}</Pill>
            <LessonAgeWarningPill lastUpdated={lesson.lastUpdated} />
            {lesson.isLatestForCourseLesson ? <Pill>最新版</Pill> : <Pill>過去開講期</Pill>}
          </div>
        </div>
        <div className="actions">
          <a className="button primary" href={lessonHref(lesson)}>授業ページ</a>
        </div>
      </div>
      <TagRow tags={[...(course?.tags || []), ...lesson.tags]} />
    </article>
  );
}
