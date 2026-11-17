# oxlint と oxfmt の導入

- status: done
- generated: 2026-11-18
- last_updated: 2026-11-18
- work_type: code

## Goal

oxlint と oxfmt を導入し、既存の指摘を解消して、コミット時に差分を検査する。

## Definition of Done

- pnpm でリポジトリ全体の lint と整形チェックが通る。
- pre-commit が対象のステージ済みファイルを検査し、既存の PDF 処理も実行する。

## Planner-added requirements

- None

## Scope / Non-goals

対象は開発依存、設定、Git hook、検査で指摘されたファイル。CI の変更や UI の変更は対象外。

## Design

既存の Lefthook に読み取り専用の lint・整形チェックを追加する。手動でも同じツールを pnpm から実行でき、失敗箇所が分かる。部分ステージ時は Lefthook が用意するステージ済みの内容を検査し、未ステージの編集を復元する。ステージの自動更新が不要で、検査コストは対象の変更ファイルに比例する。

自動修正と再ステージも可能だが、部分ステージ時に意図しない変更を取り込む経路が増え、確認すべき状態も増える。チェックのみなら既存のステージ操作を保てる。

## Compatibility stance

preserve。lefthook.yml の PDF メタデータ処理と package.json の prepare、build、typecheck を維持する。

## Context

package.json は pnpm と Lefthook を使用している。lefthook.yml の既存コマンドは scripts/strip-pdf-metadata.mjs。既存のルールスイートは見つからなかった。

## Assumptions

整形対象はプロジェクトで管理するテキストファイルとし、生成物は除外する。既存の lint 指摘の件数と種類は導入後に確定する。

## Tasks

### Task_1 — ツールと hook の導入

- type: impl
- owns: package.json, pnpm-lock.yaml, .oxlintrc.json, .oxfmtrc.json, lefthook.yml
- depends_on: []
- acceptance:
  - pnpm で lint、整形、整形チェックを実行できる。
  - pre-commit は対象の差分を検査し、既存 PDF コマンドを維持する。
- validation:
  - kind: command
    required: true
    owner: worker
    detail: 固定ロックファイルでの依存解決と、隔離した Git リポジトリでの hook の成功・失敗を確認する。対象外のファイルを確認し、コードと PDF を同時にステージして既存処理が実行されることを確かめる。部分ステージはステージ側だけが正常なとき成功し、作業ツリー側だけが正常なとき失敗することと、コミット対象と未ステージの内容が保たれることを確認する。

### Task_2 — 指摘の解消

- type: impl
- owns: src/**, scripts/build-site.mjs, scripts/strip-pdf-metadata.mjs, site/**, ルートの管理対象テキスト設定。実際の指摘箇所に限定する。Task_1 の所有ファイル、計画書、CI は除外する。
- depends_on: [Task_1]
- acceptance:
  - lint と整形の指摘を解消する。
  - 挙動を保つよう lint 修正を限定する。
- validation:
  - kind: command
    required: true
    owner: worker
    detail: lint と整形チェックを実行する。既存の動作を検証するため typecheck と build も実行する。
  - kind: review
    required: true
    owner: reviewer
    detail: 差分と検証結果を確認する。

## Task Waves

- Wave 1: [Task_1]
- Wave 2: [Task_2]

## Rollback / Safety

導入差分を取り消すと既存の Lefthook 設定に戻せる。検証では現在の作業ツリーのステージを操作しない。

## Progress Log

- 2026-11-18 設定と対象ファイルを調査して計画を作成。

- 2026-11-18 Wave 1 完了。oxlint と oxfmt の設定、依存関係、Lefthook のジョブを追加。固定ロックファイルの確認と、隔離リポジトリでの成功・失敗、部分ステージ、対象外ファイル、PDF 処理の検証が通過。新規ダウンロードは DNS 解決エラーにより未確認。
- 2026-11-18 Wave 2 完了。未使用変数の指摘3件と22ファイルの整形を修正。lint、整形チェック、型チェック、本番ビルドが通過し、91件のレッスンを生成。
- 2026-11-18 実装レビュー承認。作業ツリーの pre-commit を pnpm run prepare で更新し、プロジェクトの Lefthook 2.1.10 で起動することを確認。

## Decision Log

- 2026-11-18 計画レビューを受け、部分ステージ時の検証条件、PDF 処理の同時検証、編集範囲を明記。

- 2026-11-18 コミット時はチェックのみとし、部分ステージを保つ。

- 2026-11-18 Lefthook が未ステージの編集を一時退避することを隔離環境で確認。部分ステージを一律に止める案から、ステージ済みの内容の検査結果でコミット可否を判定する方式に変更。

- 2026-11-18 ユーザーの指摘を反映し、対象ファイルの選択からコマンド実行までを Lefthook の設定に集約する。
