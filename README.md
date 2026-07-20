# 映画館上映スケジュール比較 (Cinema Schedule Comparison)

複数映画館（TOHOシネマズ海老名、イオンシネマ新百合ヶ丘、109シネマズ南町田グランベリーパーク、イオンシネマ座間）の上映スケジュールおよび空席状況をリアルタイム・動的に比較閲覧できるWebアプリケーションです。

---

## 🌟 特徴

- **当日を含む7日間（複数日）スケジュール比較**: 本日〜6日後までの7日間を日付タブでワンタップ切り替えし、対象日の上映枠・空席データを動的比較できます。
- **リアルタイム動的取得**: スナップショット方式（静的ファイル）ではなく、ユーザーがページを開いた際や日付タブ・更新ボタンを押した際に、CORSプロキシ経由で最新の上映スケジュール・空席状況を動的フェッチして表示します。
- **MAX方式作品統合**: 対象となる各映画館から取得した作品データを網羅・名寄せしてユニーク化。作品（行）× 映画館（列）のマトリクス表で一括比較が可能です。
- **柔軟な設定ファイル**: `config/cinemas.json` を編集するだけで、比較対象の映画館名、URL、ロゴカラーなどを簡単に変更・追加できます。
- **空席情報＆予約リンク**: ◎（余裕あり）、◯（予約可能）、△（残りわずか）、×（満席）を視覚的なカラーバッジで表示。上映枠をクリックすると詳細確認および各映画館公式サイトの予約ページヘ直接遷移できます。
- **モダンUI/UX**: ガラスモルフィズムを取り入れたダークモードテーマ、作品名固定列付きレスポンシブ比較表、検索フィルター機能を搭載。

---

## 📁 フォルダ構成とファイル説明

```
cinema-schedule-comparison/
├── README.md                    # 本ドキュメント（全体概要・構成・使い方）
├── ISSUES.md                    # Issue管理インデックスドキュメント
├── index.html                   # アプリメインWebページ
├── ISSUE/                       # 個別Issueチケット管理フォルダ
│   ├── issue-1.md               # [Issue #1] 基本構造・ブランチ構築
│   ├── issue-2.md               # [Issue #2] 設定ファイル cinemas.json
│   ├── issue-3.md               # [Issue #3] CORSプロキシ動的フェッチャー
│   ├── issue-4.md               # [Issue #4] MAX方式作品統合
│   ├── issue-5.md               # [Issue #5] UI/UX・マトリクス表
│   ├── issue-6.md               # [Issue #6] 検証・最終PR準備
│   ├── issue-7.md               # [Issue #7] 当日を含む7日間の日付選択・切替
│   ├── issue-8.md               # [Issue #8] 直APIフェッチと切り戻しスイッチ
│   ├── issue-9.md               # [Issue #9] デモ（ダミー）データ明確化表示
│   └── issue-10.md              # [Issue #10] イオンシネマ新URL対応＆パーサー最適化
├── prompt/
│   └── prompt.md                # 要件定義・プロンプト指示書
├── config/
│   └── cinemas.json             # 比較対象映画館の設定ファイル
├── css/
│   ├── main.css                 # デザインシステム・ダークモード・ベーススタイル
│   └── components.css           # マトリクス表・空席バッジ・モーダルCSS
└── js/
    ├── app.js                   # 全体初期化・イベント制御・更新統括
    ├── configLoader.js          # cinemas.json 読み込みモジュール
    ├── fetchers/
    │   ├── corsProxy.js         # CORSプロキシ経由の通信処理
    │   ├── tohoFetcher.js       # TOHOシネマズ海老名用動的パース
    │   ├── aeonFetcher.js       # イオンシネマ（新百合ヶ丘・座間）用動的パース
    │   └── tokyu109Fetcher.js   # 109シネマズ南町田用動的パース
    ├── scheduleUnifier.js       # MAX方式作品ユニーク化＆マトリクス構造生成
    └── uiRender.js              # DOM描画・検索フィルター・モーダル制御
```

### ファイル詳細説明一覧

| ファイル / フォルダ | ステータス | 説明 |
| :--- | :--- | :--- |
| `README.md` | 作成済 | プロジェクトの概要、ディレクトリ構成、各ファイルの説明、利用手順を記載するメインドキュメント。 |
| `ISSUES.md` | 作成済 | 全Issueの起票状況および概要をまとめたインデックスドキュメント。 |
| `ISSUE/` | 作成済 | 個別Issueの目的・実装内容・完了条件を管理するMarkdownチケット格納フォルダ。 |
| `config/cinemas.json` | **[Issue #2] 作成済** | 比較対象の映画館名、URL、識別子、ブランドカラー等を定義する設定ファイル。 |
| `js/configLoader.js` | **[Issue #2] 作成済** | 外部設定ファイル `config/cinemas.json` を fetch して提供するモジュール。 |
| `js/fetchers/corsProxy.js` | **[Issue #3] 作成済** | CORS制限を回避するためにパブリックプロキシ経由で外部HTML/JSONを動的フェッチするモジュール。 |
| `js/fetchers/tohoFetcher.js` | **[Issue #3] 作成済** | TOHOシネマズ（海老名）用の上映スケジュール・空席動的パースモジュール。 |
| `js/fetchers/aeonFetcher.js` | **[Issue #3] 作成済** | イオンシネマ（新百合ヶ丘・座間）用の上映スケジュール・空席動的パースモジュール。 |
| `js/fetchers/tokyu109Fetcher.js` | **[Issue #3] 作成済** | 109シネマズ（南町田グランベリーパーク）用の上映スケジュール・空席動的パースモジュール。 |
| `js/scheduleUnifier.js` | **[Issue #4] 作成済** | 全映画館のデータを結合し、作品タイトルの名寄せ・ユニーク化（MAX方式）を行ってマトリクス構造を作成するモジュール。 |
| `css/main.css` | **[Issue #5] 作成済** | ダークモードテーマ、ガラスモルフィズム、カラーパレット、ベースレスポンシブスタイル。 |
| `css/components.css` | **[Issue #5] 作成済** | 作品固定列比較表、空席状況バッジ（◎ ◯ △ ×）、モーダル、ローディングアニメーション。 |
| `index.html` | **[Issue #5] 作成済** | 検索バー、リアルタイム更新ボタン、マトリクス表、空席詳細モーダルを含むメインWebページ。 |
| `js/uiRender.js` | **[Issue #5] 作成済** | マトリクス表の動的DOM構築、作品検索フィルタリング、空席モーダル表示モジュール。 |
| `js/app.js` | **[Issue #5] 作成済** | アプリケーション全体の初期化・非同期リアルタイムフェッチ統合・イベント制御。 |

---

## 🚀 ローカルでの動作方法

1. リポジトリをクローンまたはダウンロードします。
2. ディレクトリに移動し、ローカルWebサーバーを起動します。
   ```bash
   npx serve .
   # または
   python3 -m http.server 8000
   ```
3. ブラウザで `http://localhost:8000` にアクセスします。

---

## 🌐 GitHub Pages 公開手順 (無料サービス)

1. リポジトリの `Settings` -> `Pages` タブに移動します。
2. `Source` で `Deploy from a branch` を選択し、`Branch` に `main` (または `work`) / `/ (root)` を設定します。
3. `Save` を押すと数分でサイトが無料公開されます。

---

---

## ⚙️ データ取得方式と切り戻し（スイッチ設定）

映画館のデータ取得は多重フォールバック構造になっており、`config/cinemas.json` 内の `"useDirectApi"` フラグで瞬時に取得方式を切り替え可能です。

- `"useDirectApi": true` (デフォルト): 各映画館の内部JSON API/高度な直接構造化データを最優先で動的取得。
- `"useDirectApi": false` (切り戻し用): 従来のHTML直接スクレイピング方式に即座に戻すことが可能。

万が一、映画館側の仕様変更やAPI障害が発生した場合でも、設定ファイルの `"useDirectApi": false` に変更するだけで前の状態に安全に復元できます。

## 📋 初回対象映画館のURL

- **TOHOシネマズ海老名**: `https://hlo.tohotheater.jp/net/schedule/007/TNPI2000J01.do`
- **イオンシネマ新百合ヶ丘**: `https://theater.aeoncinema.com/theaters/shinyurigaoka/`
- **109シネマズ南町田グランベリーパーク**: `https://109cinemas.net/grandberrypark/`
- **イオンシネマ座間**: `https://www.aeoncinema.com/cinema/zama/`
