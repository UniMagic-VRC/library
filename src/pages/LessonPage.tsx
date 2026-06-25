import { FileSymlink } from "lucide-react";
import { findCourse, findLesson, findTerm, formatBytes, formatDate } from "../catalog";
import { LessonAgeWarningPill, Notice, Pill, TagRow } from "../components/ui";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import type { Catalog } from "../types";

export function LessonPage({ catalog }: { catalog: Catalog }) {
  const params = new URLSearchParams(window.location.search);
  const lesson = findLesson(catalog, params.get("term"), params.get("course"), params.get("lesson"));
  const course = lesson ? findCourse(catalog, lesson.courseId) : undefined;
  const term = lesson ? findTerm(catalog, lesson.termId) : undefined;
  const latestTerm = lesson ? findTerm(catalog, lesson.latestCourseTermId) : undefined;

  useDocumentTitle(lesson ? `${lesson.title} | 授業資料` : "授業 | UniMagic 過去期授業資料ライブラリ");

  if (!lesson || !course || !term) {
    return (
      <>
        <nav className="mb-[18px]" />
        <section className="mb-[30px] flex flex-col gap-2">
          <Notice tone="error">授業が見つかりません。URLの開講期、科目、授業回を確認してください。</Notice>
        </section>
      </>
    );
  }

  return (
    <>
      <nav className="mb-[18px]">
        <a className="font-bold text-accent-strong no-underline" href={`./course.html?id=${encodeURIComponent(course.id)}`}>{course.title}</a>
      </nav>
      <section className="mb-[30px] flex flex-col gap-2">
        <p className="m-0 max-w-[980px] text-[13px] font-extrabold tracking-normal text-accent-strong uppercase">{term.label} / 第{lesson.lessonNo}回</p>
        <h1 className="mt-1 mb-2 text-[clamp(30px,5vw,52px)] leading-[1.12]">{lesson.title}</h1>
        <p className="m-0 max-w-[980px] text-muted">{lesson.description || ""}</p>
        <div className="flex flex-wrap items-center gap-2">
          <LessonAgeWarningPill lastUpdated={lesson.lastUpdated} />
          {lesson.isLatestForCourseTerm ? <Pill>最新版</Pill> : <Pill className="warning">過去開講期</Pill>}
          <Pill>最終更新 {formatDate(lesson.lastUpdated)}</Pill>
        </div>
        <TagRow tags={[...(course.tags || []), ...lesson.tags]} />
      </section>

      {!lesson.isLatestForCourseTerm && (
        <a className="flex min-h-[38px] w-fit cursor-pointer flex-row items-center rounded-lg border border-orange-300 bg-orange-50 px-[13px] py-2 font-[inherit] text-warning no-underline" href={`./course.html?id=${encodeURIComponent(course.id)}&term=${encodeURIComponent(lesson.latestCourseTermId || lesson.termId)}`}>
          <FileSymlink /> より新しい開講期{latestTerm ? `（${latestTerm.label}）` : ""}の資料があります
        </a>
      )}
      <section>
        <div className="mt-[34px] mb-3.5 flex items-center justify-between gap-4">
          <h2 className="m-0 text-xl">資料</h2>
          <span className="text-sm text-muted">{lesson.files.length} 件</span>
        </div>
        <div className="grid gap-2" aria-live="polite">
          {lesson.files.map((file) => (
            <article key={file.path} className="grid grid-cols-1 gap-2">
              <div className="flex flex-wrap items-center gap-2.5">
                <strong>{file.name}</strong>
                <div className="text-sm text-muted">{formatBytes(file.size)}</div>
              </div>
              <iframe className="min-h-[min(86vh,980px)] w-full rounded-none border-0 bg-white max-[760px]:min-h-[60vh]" src={file.path} title={file.name} loading="lazy" />
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
