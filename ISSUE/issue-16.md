# [Issue #16] 劇場名ヘッダーのスクロール固定表示およびモバイル・レスポンシブ対応

- **ステータス**: 完了 (Completed)
- **担当**: 役割B (フロントエンド開発)
- **ブランチ**: `feat/issue-16-sticky-header-responsive` -> `work`

## 1. 目的
縦スクロール時でも最下部までどの映画館の列かが常に把握できるよう劇場名ヘッダー（`thead th`）をSticky固定表示にする。また、スマートフォンやタブレット（画面幅768px / 480px以下）でも快適に比較閲覧できるよう、コントロールパネル、日付タブ、テーブルレイアウトのレスポンシブ最適化を行う。

## 2. 実装内容
- `css/components.css` & `css/main.css`:
  - `.matrix-container` にスクロール上限と `position: relative;` を設定し、`thead th` を `position: sticky; top: 0; z-index: 30;` で固定。
  - 左上固定交差セル（`th.col-movie-title`）を `z-index: 40; position: sticky; top: 0; left: 0;` で固定。
  - スマホ・タブレット用メディアクエリ `@media (max-width: 768px)` / `@media (max-width: 480px)` の追加。
  - 日付選択タブ、検索バー、更新ボタンのモバイル・タッチ最適化。
- 実ブラウザ（`browser_subagent`）によるPCスクロール固定確認＆モバイルビュー確認。

## 3. 完了条件
- [x] 縦スクロール時に劇場名ヘッダーが上部に固定表示されること
- [x] スマートフォン画面幅でも崩れず、スムーズに横スクロール・縦スクロールできること
- [x] 実ブラウザテストでエラー0件かつビジュアルレンダリングが完了していること
