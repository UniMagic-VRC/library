import { lessonsForCourse } from "../catalog";
import { Notice, Pill, TagRow } from "../components/ui";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import type { Catalog, Course } from "../types";

export function HomePage({ catalog }: { catalog: Catalog }) {
  useDocumentTitle("UniMagic 過去期授業資料ライブラリ");

  return (
    <>
      <section className="mb-[30px] flex flex-col gap-2">
        <p className="m-0 max-w-[980px] text-[13px] font-extrabold tracking-normal text-accent-strong uppercase">Course Library</p>
        <h1 className="mt-1 mb-2 text-[clamp(30px,5vw,52px)] leading-[1.12]">授業資料ライブラリ</h1>
        <p className="m-0 max-w-[980px] text-muted">資料を閲覧したい科目を選択してください</p>
      </section>
      <section>
        <div className="mt-[34px] mb-3.5 flex items-center justify-between gap-4">
          <h2 className="m-0 text-xl">科目一覧</h2>
          <a className="font-bold text-accent-strong no-underline" href="./search.html">全資料を検索</a>
        </div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-4" aria-live="polite">
          {catalog.courses.map((course) => (
            <CourseCard key={course.id} catalog={catalog} course={course} />
          ))}
          {!catalog.courses.length && <Notice>科目がまだ登録されていません。</Notice>}
        </div>
      </section>
    </>
  );
}

function CourseCard({ catalog, course }: { catalog: Catalog; course: Course }) {
  const lessons = lessonsForCourse(catalog, course.id);
  const termCount = new Set(lessons.map((lesson) => lesson.termId)).size;
  const lessonCount = new Set(lessons.map((lesson) => lesson.lessonNo)).size;

  return (
    <a className="grid content-start gap-3.5 rounded-lg border border-line bg-surface p-5 text-inherit no-underline shadow-card" href={`./course.html?id=${encodeURIComponent(course.id)}`}>
      <h3 className="m-0 text-[19px] leading-[1.35]">{course.title}</h3>
      <p className="m-0 text-muted">{course.description || ""}</p>
      <div className="flex flex-wrap items-center gap-2">
        <Pill>{termCount} 開講期</Pill>
        <Pill>{lessonCount} 授業回</Pill>
      </div>
      <TagRow tags={course.tags} />
    </a>
  );
}
