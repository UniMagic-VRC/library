import { compareLessonVersion, findCourse, findLesson, findTerm, formatBytes, formatDate } from "../catalog";
import { LessonCard } from "../components/LessonCard";
import { LessonAgeWarningPill, Notice, Pill, TagRow } from "../components/ui";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import type { Catalog } from "../types";

export function LessonPage({ catalog }: { catalog: Catalog }) {
  const params = new URLSearchParams(window.location.search);
  const lesson = findLesson(catalog, params.get("term"), params.get("course"), params.get("lesson"));
  const course = lesson ? findCourse(catalog, lesson.courseId) : undefined;
  const term = lesson ? findTerm(catalog, lesson.termId) : undefined;

  useDocumentTitle(lesson ? `${lesson.title} | 授業資料` : "授業 | UniMagic 過去期授業資料ライブラリ");

  if (!lesson || !course || !term) {
    return (
      <>
        <nav className="breadcrumb" />
        <section className="page-heading">
          <Notice tone="error">授業が見つかりません。URLの開講期、科目、授業回を確認してください。</Notice>
        </section>
      </>
    );
  }

  const versions = catalog.lessons
    .filter((candidate) => candidate.courseId === lesson.courseId && candidate.lessonNo === lesson.lessonNo)
    .sort((a, b) => compareLessonVersion(catalog, a, b))
    .filter((candidate) => candidate.id !== lesson.id);

  return (
    <>
      <nav className="breadcrumb">
        <a href={`./course.html?id=${encodeURIComponent(course.id)}`}>{course.title}</a>
      </nav>
      <section className="page-heading">
        <p className="eyebrow">{term.label} / 第{lesson.lessonNo}回</p>
        <h1>{lesson.title}</h1>
        <p>{lesson.description || ""}</p>
        <div className="meta-row">
          <Pill>最終更新 {formatDate(lesson.lastUpdated)}</Pill>
          <LessonAgeWarningPill lastUpdated={lesson.lastUpdated} />
          {lesson.isLatestForCourseLesson ? <Pill>最新版</Pill> : <Pill>過去開講期</Pill>}
        </div>
        <TagRow tags={[...(course.tags || []), ...lesson.tags]} />
      </section>
      <section>
        <div className="section-title">
          <h2>資料</h2>
          <span className="muted">{lesson.files.length} 件</span>
        </div>
        <div className="file-list" aria-live="polite">
          {lesson.files.map((file) => (
            <article key={file.path} className="file-item">
              <div className="file-metadata">
                <strong>{file.name}</strong>
                <div className="muted">{formatBytes(file.size)}</div>
              </div>
              <iframe className="pdf-frame" src={file.path} title={file.name} loading="lazy" />
            </article>
          ))}
        </div>
      </section>
      <section>
        <div className="section-title">
          <h2>他開講期の同じ授業</h2>
        </div>
        <div className="lesson-list" aria-live="polite">
          {versions.map((version) => <LessonCard key={version.id} catalog={catalog} lesson={version} />)}
          {!versions.length && <Notice>他開講期の同じ授業はありません。</Notice>}
        </div>
      </section>
    </>
  );
}
