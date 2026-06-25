import { useMemo, useState } from "react";
import {
  allTags,
  compareLessonVersion,
  normalizeLessonNo,
  sameTags,
  selectedTagsMatch,
  textMatches
} from "../catalog";
import { LessonCard } from "../components/LessonCard";
import { Notice } from "../components/ui";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import type { Catalog } from "../types";

export function SearchPage({ catalog }: { catalog: Catalog }) {
  const params = new URLSearchParams(window.location.search);
  const [query, setQuery] = useState(params.get("q") || "");
  const [courseId, setCourseId] = useState(params.get("course") || "");
  const [termId, setTermId] = useState(params.get("term") || "");
  const [lessonNo, setLessonNo] = useState(params.get("lesson") || "");
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const tags = useMemo(() => allTags(catalog), [catalog]);

  useDocumentTitle("全資料検索 | UniMagic 過去期授業資料ライブラリ");

  const results = catalog.lessons
    .filter((lesson) => {
      if (!termId) return true;
      if (termId === "latest") return lesson.isLatestForCourseLesson;
      return lesson.termId === termId;
    })
    .filter((lesson) => !courseId || lesson.courseId === courseId)
    .filter((lesson) => !lessonNo || lesson.lessonNo === normalizeLessonNo(lessonNo))
    .filter((lesson) => selectedTagsMatch(catalog, lesson, selectedTags))
    .filter((lesson) => textMatches(catalog, lesson, query.trim().toLowerCase()))
    .sort((a, b) => compareLessonVersion(catalog, a, b));

  function toggleTag(tag: string) {
    const next = new Set(selectedTags);
    if (next.has(tag)) next.delete(tag);
    else next.add(tag);
    setSelectedTags(next);
  }

  function selectView(tagsForView: string[] = []) {
    setSelectedTags(new Set(tagsForView));
  }

  return (
    <>
      <section className="page-heading">
        <p className="eyebrow">Search</p>
        <h1>全資料検索</h1>
        <p>開講期はすべてを対象に検索します。必要に応じて特定の期や最新版だけに絞り込めます。</p>
      </section>
      <section className="filters" aria-label="検索条件">
        <label>
          キーワード
          <input value={query} onChange={(event) => setQuery(event.target.value)} type="search" placeholder="授業名、説明、タグ" />
        </label>
        <label>
          科目
          <select value={courseId} onChange={(event) => setCourseId(event.target.value)}>
            <option value="">すべて</option>
            {catalog.courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}
          </select>
        </label>
        <label>
          開講期
          <select value={termId} onChange={(event) => setTermId(event.target.value)}>
            <option value="">すべて</option>
            <option value="latest">最新開講期のみ</option>
            {catalog.terms.map((term) => <option key={term.id} value={term.id}>{term.label}</option>)}
          </select>
        </label>
        <label>
          授業回
          <input value={lessonNo} onChange={(event) => setLessonNo(event.target.value)} type="text" placeholder="01" />
        </label>
      </section>
      <section>
        <div className="section-title">
          <h2>タグ</h2>
          <button className="button secondary" type="button" onClick={() => setSelectedTags(new Set())}>クリア</button>
        </div>
        <div className="segmented compact" aria-label="ビュー">
          {(catalog.searchViews || []).map((view) => {
            const viewTags = new Set(view.tags || []);
            return (
              <button key={view.label} type="button" aria-pressed={sameTags(viewTags, selectedTags)} onClick={() => selectView(view.tags)}>
                {view.label}
              </button>
            );
          })}
        </div>
        <div className="tag-picker" aria-label="タグ">
          {tags.map((tag) => (
            <button key={tag} type="button" aria-pressed={selectedTags.has(tag)} onClick={() => toggleTag(tag)}>
              {tag}
            </button>
          ))}
        </div>
      </section>
      <section>
        <div className="section-title">
          <h2>検索結果</h2>
          <span className="muted">{results.length} 件</span>
        </div>
        <div className="lesson-list" aria-live="polite">
          {results.map((lesson) => <LessonCard key={lesson.id} catalog={catalog} lesson={lesson} showCourse />)}
          {!results.length && <Notice>条件に一致する資料はありません。</Notice>}
        </div>
      </section>
    </>
  );
}
