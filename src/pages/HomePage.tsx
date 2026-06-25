import { lessonsForCourse } from "../catalog";
import { Notice, Pill, TagRow } from "../components/ui";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import type { Catalog, Course } from "../types";

export function HomePage({ catalog }: { catalog: Catalog }) {
  useDocumentTitle("UniMagic 過去期授業資料ライブラリ");

  return (
    <>
      <section className="page-heading">
        <p className="eyebrow">Course Library</p>
        <h1>授業資料ライブラリ</h1>
        <p>資料を閲覧したい科目を選択してください</p>
      </section>
      <section>
        <div className="section-title">
          <h2>科目一覧</h2>
          <a className="text-link" href="./search.html">全資料を検索</a>
        </div>
        <div className="grid" aria-live="polite">
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
    <a className="card" href={`./course.html?id=${encodeURIComponent(course.id)}`}>
      <h3>{course.title}</h3>
      <p>{course.description || ""}</p>
      <div className="meta-row">
        <Pill>{termCount} 開講期</Pill>
        <Pill>{lessonCount} 授業回</Pill>
      </div>
      <TagRow tags={course.tags} />
    </a>
  );
}
