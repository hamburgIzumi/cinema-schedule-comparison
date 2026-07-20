# [Issue #12] Cloudflare Workers 内部パースロジックの精密化とデバッグ

- **ステータス**: 完了 (Completed)
- **担当**: 役割B (フロントエンド開発)
- **ブランチ**: `feat/issue-12-worker-debug` -> `work`

## 1. 目的
Cloudflare Workers APIとの通信自体は成功しているものの、Worker内部のHTML解析処理（正規表現/文字列抽出）が実映画館サイトの最新HTML構造と一致せず `isFallback: true`（ダミーデータ）を返してしまっている問題をデバッグ・修正する。

## 2. デバッグ・修正内容
- `workers/index.js`:
  - 映画館サイト（TOHO・イオン・109）の実際のHTMLタグ・CSSクラス・JSONデータ構造に適合する堅牢なマルチパターン抽出ロジックの実装
  - デバッグ出力機能（`?debug=true`）の追加
- 通信ヘッダー（`User-Agent`, `Referer`, `Accept`）の最適化

## 3. 完了条件
- [x] Worker API から `isFallback: false` で各映画館の本物の実スケジュールデータが返却されること
- [x] 画面の「⚠️ デモ（ダミー）データ」バッジが解除され、本物の空席状況が表示されること
