# 授業資料の PDF ビューア実装計画

- status: done
- generated: 2026-11-18
- last_updated: 2026-11-18
- work_type: code

## Goal

授業ページの iframe を、ページ送りと拡大縮小ができるアプリ内 PDF ビューアに置き換える。

## Definition of Done

- 授業ページで既存の PDF を表示できる。
- ページ送り、現在ページと総ページ数、幅に合わせた初期表示、拡大縮小を提供する。
- 読み込み中と失敗を表示し、元の PDF を開くリンクを提供する。
- 本番ビルドを通し、デスクトップとモバイル幅で実資料の表示と操作を確認する。

## Planner-added requirements

- ページ送りとページ数表示により、複数ページの資料を最後まで読めるようにする。最初と最後では範囲外へ進めないようにする。
- 幅に合わせた初期表示と拡大縮小により、狭い画面でも全体を見渡し、細部を読めるようにする。
- 読み込み・失敗表示と PDF へのリンクにより、描画を待つ場合や描画できない場合も資料へのアクセス手段を示す。
- 表示ページだけを描画し、ページ変更やビューアの破棄で不要になった処理を解放する。資料のページ数に比例したキャンバスの確保を避ける。
- PDF.js のワーカーをアプリのビルドに含め、配信環境で PDF と描画処理を読み込めることを確認する。
- 本番ビルドとデスクトップ・モバイル幅の操作確認で、埋め込みから切り替えた後も授業資料が読めることを確認する。描画失敗を再現し、エラー表示とアクセス手段が見えることも確認する。

## Scope / Non-goals

- Scope — 授業ページの PDF 表示と操作。
- Non-goals — 注釈、サムネイル、全文検索。

## Design

- Chosen: PDF.js を React コンポーネントから使う。表示状態は資料ごとにコンポーネントが持ち、描画は PDF.js に委ねる。操作追加がビューア内に収まり、本番配信の資料 URL で検証できる。表示ページ分のキャンバスを使い、表示失敗時は既存 PDF にリンクする。ワーカーと PDF はサイトから取得する。ライブラリの API と描画ライフサイクルをアプリ側で扱う。
- Alternative: PDF.js を使う既製の React ビューアを導入する。ビューアが状態と UI を管理し、アプリ側の描画コードは減る。操作や見た目の変更は採用ライブラリの API に依存し、検証では同じ公開画面を操作する。依存と配信設定が増え、処理負荷や失敗時の表示は採用ライブラリの設定に依存する。ワーカーと PDF の取得先は同じサイトにできる。
- Why chosen: 基本操作に絞るため、既存の授業ページに合わせて操作 UI を作り、追加する依存を描画ライブラリに絞る。

## Compatibility stance

- surface: 授業ページの URL と資料パス
- stance: preserve
- justification: `src/components/LessonCard.tsx` が `src/catalog.ts` の `lessonHref` で授業 URL を作り、`src/pages/LessonPage.tsx` が授業を選ぶ。資料 URL は `scripts/build-site.mjs` の `materialFile` が生成し、授業ページの `file.path` で使う。

## Context (workspace)

- `src/pages/LessonPage.tsx` が資料一覧と iframe を表示する。
- `package.json` に Vite 本番ビルドがあり、`materials/term-02b/world-specialized/04.pdf` などの実資料を使える。

## Tasks

### Task_1: PDF ビューアの実装

- type: impl
- owns: [src/pages/LessonPage.tsx, src/components/PdfViewer.tsx, package.json, pnpm-lock.yaml]
- depends_on: []
- acceptance:
  - 資料ごとに PDF を描画し、ページ送り、ページ数表示、初期幅合わせ、拡大縮小を提供する。
  - 読み込みとエラーを表示し、元の PDF を開ける。
  - 表示ページだけを描画し、不要な描画と読み込みを解放する。
  - PDF.js のワーカーを本番ビルドに含める。
- validation:
  - kind: command
    required: true
    owner: worker
    detail: "pnpm build"

### Task_2: 実装レビューとブラウザ検証

- type: review
- owns: []
- depends_on: [Task_1]
- acceptance:
  - 実装が Task_1 の受け入れ条件を満たす。
  - E2E の操作結果とスクリーンショットを確認できる。
- validation:
  - kind: e2e
    required: true
    owner: reviewer
    detail: "以下のシナリオを本番ビルドで検証する"

## Task Waves

- Wave 1 (parallel): [Task_1]
- Wave 2 (parallel): [Task_2]

## E2E / Visual Validation Spec

- provider: playwright-cli（PATH にない場合は pnpm dlx @playwright/cli@0.1.24 で起動）
- artifact_root: .playwright-cli/
- base_url: http://127.0.0.1:4173/library/
- app_start_command: pnpm exec vite preview --host 127.0.0.1 --port 4173 --strictPort
- readiness_check: トップページが取得できる
- flows: `/library/lesson.html?term=term-02b&course=world-specialized&lesson=04` を開く。表紙の後にある授業スライドの描画、前後移動、端でのページ送り制御、ズーム、元 PDF リンクの URL と取得結果を確認する。モバイルでは初期幅が収まり、拡大後もスクロールでページ全体にアクセスできることを確認する。PDF リクエストの失敗時はエラーとリンクを確認する。
- viewports: 1440×900 と 390×844
- evidence_requirements: 両サイズの表示のスクリーンショットと PDF およびワーカーの読み込み結果
- known_flakiness: PDF 描画完了を待って確認する。

## Rollback / Safety

実装差分を戻して授業ページの iframe 表示に戻せる。

## Progress Log

- 2026-11-18 草案作成。Research waived: 変更箇所が授業ページの資料表示に局在し、コードとパッケージ設定を直接確認できた。
- 2026-11-18 Wave 1 完了。Task_1 の変更範囲を照合し、pnpm build でワーカーの出力と授業 91 件の生成を確認。
- 2026-11-18 Wave 2 完了。Reviewer APPROVED。本番プレビューでデスクトップとモバイル幅の日本語描画と操作、元 PDF の取得、通信失敗時の表示を確認。エビデンスは .playwright-cli/pdf-viewer-{desktop,mobile,error}.png。連続ページ送り時に PDF.js のフォント回復警告を 1 件確認し、検証した表示への影響は見られなかった。

## Decision Log

- 2026-11-18 ページ移動と拡大縮小を初期範囲として提案。
