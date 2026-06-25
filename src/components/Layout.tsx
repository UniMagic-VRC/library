import type { Page } from "../types";

export function SiteHeader({ page }: { page: Page }) {
  return (
    <header className="site-header">
      <a className="brand" href="./index.html">
        <img src="./assets/unimagic-logo.svg" alt="UniMagic" />
        <span>過去期授業資料ライブラリ</span>
      </a>
      <nav className="nav">
        <a href="./index.html" aria-current={page === "home" ? "page" : undefined}>科目</a>
        <a href="./search.html" aria-current={page === "search" ? "page" : undefined}>全資料検索</a>
      </nav>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <nav className="footer-nav" aria-label="フッター">
          <a href="./index.html">科目一覧</a>
          <a href="./search.html">全資料検索</a>
        </nav>
        <p>© UniMagic</p>
      </div>
    </footer>
  );
}
