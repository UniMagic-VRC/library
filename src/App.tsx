import { useEffect, useState } from "react";
import { SiteFooter, SiteHeader } from "./components/Layout";
import { Notice } from "./components/ui";
import { loadCatalog } from "./catalog";
import { CoursePage } from "./pages/CoursePage";
import { HomePage } from "./pages/HomePage";
import { LessonPage } from "./pages/LessonPage";
import { SearchPage } from "./pages/SearchPage";
import type { Catalog, Page } from "./types";

export function App() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [error, setError] = useState<string | null>(null);
  const page = (document.body.dataset.page || "home") as Page;

  useEffect(() => {
    loadCatalog().then(setCatalog).catch((loadError: unknown) => {
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    });
  }, []);

  return (
    <>
      <SiteHeader page={page} />
      <main className="mx-auto w-[min(1600px,calc(100%-24px))] flex-1 py-10 pb-[72px]">
        {error && <Notice tone="error">{error}</Notice>}
        {!error && !catalog && <Notice>読み込み中です。</Notice>}
        {!error && catalog && <PageContent page={page} catalog={catalog} />}
      </main>
      <SiteFooter />
    </>
  );
}

function PageContent({ page, catalog }: { page: Page; catalog: Catalog }) {
  if (page === "course") return <CoursePage catalog={catalog} />;
  if (page === "lesson") return <LessonPage catalog={catalog} />;
  if (page === "search") return <SearchPage catalog={catalog} />;
  return <HomePage catalog={catalog} />;
}
