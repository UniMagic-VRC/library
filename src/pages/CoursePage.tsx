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
        <nav className="breadcrumb"><a href="./index.html">科目一覧</a></nav>
        <section className="page-heading">
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
      <nav className="breadcrumb"><a href="./index.html">科目一覧</a></nav>
      <section className="page-heading">
        <p className="eyebrow">Course</p>
        <h1>{course.title}</h1>
        <p>{course.description || ""}</p>
        <TagRow tags={course.tags} />
      </section>
      <section>
        <div className="section-title">
          <h2>開講期</h2>
          <span className="muted">{terms.length} 開講期</span>
        </div>
        <div className="segmented" role="tablist" aria-label="開講期">
          {terms.map((term) => (
            <button
              key={term.id}
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
        <div className="section-title">
          <h2>授業回</h2>
          <a className="text-link" href={`./search.html?course=${encodeURIComponent(currentCourse.id)}`}>この科目を検索</a>
        </div>
        <div className="lesson-list" aria-live="polite">
          {lessons.map((lesson) => <LessonCard key={lesson.id} catalog={catalog} lesson={lesson} />)}
          {!lessons.length && <Notice>この開講期の授業は登録されていません。</Notice>}
        </div>
      </section>
    </>
  );
}
