import { useEffect, useState } from "react";
import { compareLessonNo, findCourse, lessonsForCourse, termsForLessons } from "../catalog";
import { LessonCard } from "../components/LessonCard";
import { Notice, TagRow } from "../components/ui";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import type { Catalog } from "../types";

export function CoursePage({ catalog }: { catalog: Catalog }) {
  const params = new URLSearchParams(window.location.search);
  const courseId = params.get("id");
  const course = findCourse(catalog, courseId);
  const courseLessons = course ? lessonsForCourse(catalog, course.id) : [];
  const terms = termsForLessons(catalog, courseLessons);
  const initialTermId = params.get("term") || terms[0]?.id || null;
  const [selectedTermId, setSelectedTermId] = useState(initialTermId);

  useEffect(() => {
    setSelectedTermId(initialTermId);
  }, [initialTermId]);

  useDocumentTitle(course ? `${course.title} | 授業資料` : "科目 | UniMagic 過去期授業資料ライブラリ");

  if (!course) {
    return (
      <>
        <nav className="mb-[18px]"><a className="font-bold text-accent-strong no-underline" href="./index.html">科目一覧</a></nav>
        <section className="mb-[30px] flex flex-col gap-2">
          <Notice tone="error">科目が見つかりません。</Notice>
        </section>
      </>
    );
  }

  const currentCourse = course;
  const lessons = courseLessons
    .filter((lesson) => lesson.termId === selectedTermId)
    .sort(compareLessonNo);

  function selectTerm(termId: string) {
    setSelectedTermId(termId);
    history.replaceState(null, "", `./course.html?id=${encodeURIComponent(currentCourse.id)}&term=${encodeURIComponent(termId)}`);
  }

  return (
    <>
      <nav className="mb-[18px]"><a className="font-bold text-accent-strong no-underline" href="./index.html">科目一覧</a></nav>
      <section className="mb-[30px] flex flex-col gap-2">
        <p className="m-0 max-w-[980px] text-[13px] font-extrabold tracking-normal text-accent-strong uppercase">Course</p>
        <h1 className="mt-1 mb-2 text-[clamp(30px,5vw,52px)] leading-[1.12]">{course.title}</h1>
        <p className="m-0 max-w-[980px] text-muted">{course.description || ""}</p>
        <TagRow tags={course.tags} />
      </section>
      <section>
        <div className="mt-[34px] mb-3.5 flex items-center justify-between gap-4">
          <h2 className="m-0 text-xl">開講期</h2>
          <span className="text-sm text-muted">{terms.length} 開講期</span>
        </div>
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="開講期">
          {terms.map((term) => (
            <button
              key={term.id}
              className="flex min-h-[38px] cursor-pointer flex-row items-center rounded-lg border border-line bg-surface px-[13px] py-2 font-[inherit] text-ink aria-pressed:border-accent aria-pressed:bg-accent aria-pressed:text-white"
              type="button"
              aria-pressed={term.id === selectedTermId}
              onClick={() => selectTerm(term.id)}
            >
              {term.label}
            </button>
          ))}
        </div>
      </section>
      <section>
        <div className="mt-[34px] mb-3.5 flex items-center justify-between gap-4">
          <h2 className="m-0 text-xl">授業回</h2>
          <a className="font-bold text-accent-strong no-underline" href={`./search.html?course=${encodeURIComponent(currentCourse.id)}`}>この科目を検索</a>
        </div>
        <div className="grid gap-2" aria-live="polite">
          {lessons.map((lesson) => <LessonCard key={lesson.id} catalog={catalog} lesson={lesson} />)}
          {!lessons.length && <Notice>この開講期の授業は登録されていません。</Notice>}
        </div>
      </section>
    </>
  );
}
