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
      if (termId === "latest") return lesson.isLatestForCourseTerm;
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
      <section className="mb-[30px] flex flex-col gap-2">
        <p className="m-0 max-w-[980px] text-[13px] font-extrabold tracking-normal text-accent-strong uppercase">Search</p>
        <h1 className="mt-1 mb-2 text-[clamp(30px,5vw,52px)] leading-[1.12]">全資料検索</h1>
        <p className="m-0 max-w-[980px] text-muted">開講期はすべてを対象に検索します。必要に応じて特定の期や最新開講期だけに絞り込めます。</p>
      </section>
      <section className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-3 rounded-lg border border-line bg-surface p-4 max-[760px]:grid-cols-1" aria-label="検索条件">
        <label className="grid gap-1.5 text-[13px] font-bold text-muted">
          キーワード
          <input className="min-h-10 w-full rounded-lg border border-line bg-white px-2.5 py-2 font-[inherit] text-ink" value={query} onChange={(event) => setQuery(event.target.value)} type="search" placeholder="授業名、説明、タグ" />
        </label>
        <label className="grid gap-1.5 text-[13px] font-bold text-muted">
          科目
          <select className="min-h-10 w-full rounded-lg border border-line bg-white px-2.5 py-2 font-[inherit] text-ink" value={courseId} onChange={(event) => setCourseId(event.target.value)}>
            <option value="">すべて</option>
            {catalog.courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}
          </select>
        </label>
        <label className="grid gap-1.5 text-[13px] font-bold text-muted">
          開講期
          <select className="min-h-10 w-full rounded-lg border border-line bg-white px-2.5 py-2 font-[inherit] text-ink" value={termId} onChange={(event) => setTermId(event.target.value)}>
            <option value="">すべて</option>
            <option value="latest">最新開講期のみ</option>
            {catalog.terms.map((term) => <option key={term.id} value={term.id}>{term.label}</option>)}
          </select>
        </label>
        <label className="grid gap-1.5 text-[13px] font-bold text-muted">
          授業回
          <input className="min-h-10 w-full rounded-lg border border-line bg-white px-2.5 py-2 font-[inherit] text-ink" value={lessonNo} onChange={(event) => setLessonNo(event.target.value)} type="text" placeholder="01" />
        </label>
      </section>
      <section>
        <div className="mt-[34px] mb-3.5 flex items-center justify-between gap-4">
          <h2 className="m-0 text-xl">タグ</h2>
          <button className="flex min-h-[38px] cursor-pointer flex-row items-center rounded-lg border border-line bg-surface-strong px-[13px] py-2 font-[inherit] text-ink" type="button" onClick={() => setSelectedTags(new Set())}>クリア</button>
        </div>
        <div className="mb-3 flex flex-wrap gap-2" aria-label="ビュー">
          {(catalog.searchViews || []).map((view) => {
            const viewTags = new Set(view.tags || []);
            return (
              <button
                key={view.label}
                className="flex min-h-[38px] cursor-pointer flex-row items-center rounded-lg border border-line bg-surface px-[13px] py-2 font-[inherit] text-ink aria-pressed:border-accent aria-pressed:bg-accent aria-pressed:text-white"
                type="button"
                aria-pressed={sameTags(viewTags, selectedTags)}
                onClick={() => selectView(view.tags)}
              >
                {view.label}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-2" aria-label="タグ">
          {tags.map((tag) => (
            <button
              key={tag}
              className="flex min-h-[38px] cursor-pointer flex-row items-center rounded-lg border border-line bg-surface px-[13px] py-2 font-[inherit] text-ink aria-pressed:border-accent aria-pressed:bg-accent aria-pressed:text-white"
              type="button"
              aria-pressed={selectedTags.has(tag)}
              onClick={() => toggleTag(tag)}
            >
              {tag}
            </button>
          ))}
        </div>
      </section>
      <section>
        <div className="mt-[34px] mb-3.5 flex items-center justify-between gap-4">
          <h2 className="m-0 text-xl">検索結果</h2>
          <span className="text-sm text-muted">{results.length} 件</span>
        </div>
        <div className="grid gap-2" aria-live="polite">
          {results.map((lesson) => <LessonCard key={lesson.id} catalog={catalog} lesson={lesson} showCourse />)}
          {!results.length && <Notice>条件に一致する資料はありません。</Notice>}
        </div>
      </section>
    </>
  );
}
