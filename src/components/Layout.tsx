import type { Page } from "../types";

export function SiteHeader({ page }: { page: Page }) {
  const navLinkClass = "min-h-[38px] rounded-lg border border-transparent px-[13px] py-2 font-[inherit] no-underline text-muted hover:bg-accent-soft hover:text-accent-strong aria-[current=page]:bg-accent-soft aria-[current=page]:text-accent-strong";

  return (
    <header className="sticky top-0 z-10 flex items-center justify-between gap-6 border-b border-line bg-white/90 px-4 py-3.5 backdrop-blur-md md:px-12 max-[760px]:grid max-[760px]:items-start">
      <a className="inline-flex items-center gap-2.5 text-lg text-black no-underline" href="./index.html">
        <img className="block h-[34px] w-auto" src="./assets/unimagic-logo.svg" alt="UniMagic" />
        <span>過去期授業資料ライブラリ</span>
      </a>
      <nav className="flex gap-2 max-[760px]:overflow-x-auto">
        <a className={navLinkClass} href="./index.html" aria-current={page === "home" ? "page" : undefined}>科目</a>
        <a className={navLinkClass} href="./search.html" aria-current={page === "search" ? "page" : undefined}>全資料検索</a>
      </nav>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-white">
      <div className="mx-auto flex min-h-[104px] w-[min(1600px,calc(100%-24px))] items-center justify-between gap-5 py-6 max-[760px]:flex-col max-[760px]:items-start">
        <nav className="flex flex-wrap justify-center gap-3.5 max-[760px]:justify-start" aria-label="フッター">
          <a className="text-sm font-bold text-muted no-underline hover:text-accent-strong" href="./index.html">科目一覧</a>
          <a className="text-sm font-bold text-muted no-underline hover:text-accent-strong" href="./search.html">全資料検索</a>
        </nav>
        <p className="m-0 text-[13px] font-bold text-muted">© UniMagic</p>
      </div>
    </footer>
  );
}
