# [Issue #14] 最小構成化：イオンシネマ単独化と他館実装の全撤去

- **ステータス**: 完了 (Completed)
- **担当**: 役割B (フロントエンド開発)
- **ブランチ**: `feat/issue-14-minimal-aeon-only` -> `work`

## 1. 目的
トラブルシューティングおよび問題切り分けのため、TOHOシネマズおよび109シネマズのフェッチ・表示・コード実装をすべて撤去し、「イオンシネマ（新百合ヶ丘・座間）」のみを取得・比較表示する最小構成（Minimal Structure）にシンプル化する。

## 2. 実装内容
- `config/cinemas.json`: `toho-ebina` および `109-minamimachida` を削除し、イオンシネマ2館（`aeon-shinyurigaoka`, `aeon-zama`）のみに設定。
- `workers/index.js`: TOHOおよび109のフェッチ・パースロジックを完全撤去し、イオンシネマ専用プロキシAPIに整理。
- `js/fetchers/`: `tohoFetcher.js` および `tokyu109Fetcher.js` を削除し、`aeonFetcher.js` のみに絞り込み。
- `js/app.js` & `js/scheduleUnifier.js`: イオンシネマ単独のデータ統合・表示処理に最適化。

## 3. 完了条件
- [x] 109シネマズおよびTOHOシネマズの取得・表示コードが完全に削除されていること
- [x] イオンシネマ（新百合ヶ丘・座間）のみが表示・比較される最小構成で動作すること
- [x] ローカル環境およびWorkersの動作確認が完了していること
