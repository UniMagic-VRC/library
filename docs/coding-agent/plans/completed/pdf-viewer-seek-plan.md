# PDF ビューアのページ選択とスライド内リンク

- status: done
- generated: 2026-11-18
- last_updated: 2026-11-18
- work_type: code

## Goal

授業資料をシークバーで移動し、サムネイルで移動先を確認できるようにする。スライドに設定されたリンクを開けるようにする。

## Definition of Done

- PDF の下にページ単位のシークバーと、指しているページを示すサムネイルが表示される。
- シークバーと既存の左右クリックが同じ表示ページを更新する。サムネイルで移動先をプレビューする。
- PDF のリンク注釈をクリックまたはキーボードで操作でき、外部リンクを開いたり PDF 内の指定ページへ移動したりできる。
- PC 幅とモバイル幅で、選択したページの描画とスクロール位置を確認できる。

## Planner-added requirements

- PDF の下にシークバーを置き、指したページのプレビューをバーの上に表示する。
- ビューアと選択表示が同じページ番号を参照する。どの操作でも表示ページが分かる。
- プレビューに必要なページだけを小さく描画する。長い資料の一括描画を避ける。
- プレビュー対象が変わったら、不要なサムネイルの描画だけを取り消す。共有ドキュメントで本文の描画を継続できるようにする。
- 実資料で PC 幅とモバイル幅を検証する。操作領域の幅とページ移動時のスクロールを実際に確認する。

- 外部リンクは別タブで開く。授業資料を開いた位置に戻れるようにする。PDF.js が解釈した HTTP、HTTPS、mailto のリンクを扱い、PDF 内の任意のアクションを実行しない。
- リンクの位置をズーム・幅変更後もスライドに合わせる。リンク上の操作は左右クリックによるページ送りから除外する。

## Scope / Non-goals

- Scope — 既存 PDF ビューア内でのページ選択と PDF に設定されたリンク。

## Design

- Chosen: 現在のページ番号を共有し、PDF.js の同じドキュメントから必要なサムネイルを描画する。入力は標準のレンジとボタンで検証できる。低解像度で画面に近いサムネイルだけを描画するため、表示範囲の監視と描画の解放が必要になる。データは現在の資料 URL から取得する。
- Alternative: 初回に全ページ分のサムネイルを順番に描画する。表示範囲の管理が不要で、テスト時に一覧が揃うまで待てる。描画時間とメモリがページ数に応じて増える。描画元と配信範囲は同じ。
- Why chosen: サムネイルを待たずに冒頭のスライドを読めるようにする。

- Links chosen: 現在のページのリンク注釈からキャンバス上に操作できる領域を配置する。描画と同じ座標変換を使い、宛先は既存のページ番号に接続する。リンク対象の位置、遷移、操作対象外のクリックをブラウザで確認できる。注釈取得は表示ページ分に限る。
- Links alternative: PDF.js の汎用注釈レイヤーを構成する。注釈全般の表示に使える一方、リンク以外の注釈と関連サービスの設定も必要になる。今回はリンクに絞り、ページ送りとの連携を既存ビューア内で扱う。

## Context (workspace)

- `src/components/PdfViewer.tsx` が PDF.js のドキュメントと現在ページを管理する。

## Tasks

### Task_1: ページ選択 UI

- type: impl
- owns: [src/components/PdfViewer.tsx, src/components/PdfSeekBar.tsx]
- depends_on: []
- acceptance:
  - シークバーで任意のページへ移動でき、既存のページ送りと同期する。
  - バーを指すと対象ページのサムネイルが浮かび、モバイルではドラッグ中に表示される。
- validation:
  - kind: command
    required: true
    owner: worker
    detail: "pnpm build"

### Task_2: スライド内リンク

- type: impl
- owns: [src/components/PdfViewer.tsx, src/components/PdfPageLinks.tsx]
- depends_on: [Task_1]
- acceptance:
  - 表示中のページのリンクを、キーボードとポインタで操作できる。
  - 外部リンクは別タブで開き、PDF 内のページ宛先はビューアで開く。
  - ズームや幅変更後もリンク領域が画像と一致し、リンク操作で左右のページ送りが起きない。
- validation:
  - kind: command
    required: true
    owner: worker
    detail: "pnpm build"

### Task_3: ブラウザ検証

- type: review
- owns: []
- depends_on: [Task_2]
- acceptance:
  - 実資料でページ選択と表示の同期を確認する。
  - PC 幅とモバイル幅でサムネイルとスクロール位置を確認する。
  - リンク注釈の位置と遷移、既存のページ送りとの干渉を確認する。
- validation:
  - kind: e2e
    required: true
    owner: reviewer
    detail: "以下のシナリオを本番ビルドで確認する"

## Task Waves

- Wave 1 (parallel): [Task_1]
- Wave 2 (parallel): [Task_2]
- Wave 3 (parallel): [Task_3]

## E2E / Visual Validation Spec

- provider: playwright-cli
- artifact_root: .playwright-cli/
- base_url: http://127.0.0.1:4174/library/
- app_start_command: pnpm exec vite preview --host 127.0.0.1 --port 4174 --strictPort
- readiness_check: トップページが取得できる
- flows: `lesson.html?term=term-02b&course=world-specialized&lesson=04` を開き、レンジの素早いドラッグで最後に選んだページの描画とキー操作、ホバーで現在ページを変えずに候補ページをプレビューできること、既存の左右クリックでシークバーが同期することを確認する。モバイル幅でドラッグ中の表示と、選択時にページ上部へ飛ばないことを確認する。リンク注釈を持つ PDF で、外部リンク、PDF 内リンク、ズーム後のクリック位置とリンク周囲のページ送りを確認する。実資料でリンク種別を揃えられない場合は検証用 PDF を一時的に使う。
- viewports: 1440×900 と 390×844
- evidence_requirements: 両サイズのスクリーンショットと各操作の結果
- known_flakiness: 描画完了を待って確認する。

## Progress Log

- 2026-11-18 草案作成。Research waived: 直前まで作業したビューア内の変更で、既存の状態と描画処理を直接確認できる。
- 2026-11-18 Wave 1 完了。シークバーとサムネイルを追加し、pnpm build で授業 91 件の生成を確認。
- 2026-11-18 Wave 2 完了。スライド内リンクを追加し、pnpm build で授業 91 件の生成を確認。
- 2026-11-18 参考画像に沿ったプレビューの本番ビルドが成功。Wave 3 は APPROVED。デスクトップでホバー・ドラッグ・キー操作、モバイルでタッチ操作とスクロール維持、検証用 PDF で外部リンクと内部リンクおよび拡大後の位置を確認。画像は .playwright-cli/pdf-hover-{desktop,mobile,links}.png。

## Decision Log

- 2026-11-18 PDF の下にシークバーとサムネイルを配置する案を作成。

- 2026-11-18 ユーザーの追加要望を受け、スライド内リンクを追加。

- 2026-11-18 参考画像を受け、常時表示の一覧をシークバー上の単一プレビューに変更。
