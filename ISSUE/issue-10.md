# [Issue #10] イオンシネマ新URL対応（theater.aeoncinema.com）と映画館パーサー最適化

- **ステータス**: 完了 (Completed)
- **担当**: 役割B (フロントエンド開発)
- **ブランチ**: `feat/issue-10-url-optimize` -> `work`

## 1. 目的
イオンシネマの最新ドメイン（`https://theater.aeoncinema.com/theaters/{code}/?date=YYYYMMDD`）を採用し、日付クエリ連動および最新HTML構造のパース処理を最適化することで、本物の実データ取得成功率を高める。

## 2. 実装内容
- `config/cinemas.json`:
  - イオンシネマ座間: `https://theater.aeoncinema.com/theaters/zama/`
  - イオンシネマ新百合ヶ丘: `https://theater.aeoncinema.com/theaters/shinyurigaoka/`
- `js/fetchers/aeonFetcher.js`: `theater.aeoncinema.com` の最新HTML要素構造（`.movie_box`, `.time_box`, `.seat` 等）に合わせたパース抽出処理の完全最適化
- `js/fetchers/tohoFetcher.js` & `tokyu109Fetcher.js`: 抽出セレクタの多重化・堅牢化

## 3. 完了条件
- [x] イオンシネマのURLが `theater.aeoncinema.com` 形式に更新されていること
- [x] 日付パラメータ（`?date=YYYYMMDD`）付きで対象日の最新上映スケジュールが正常パースされること
