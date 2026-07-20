# 映画館上映スケジュール比較 (Cinema Schedule Comparison)

複数映画館の上映スケジュールおよび空席状況をリアルタイム・動的に比較閲覧できるWebアプリケーションです。

## 概要

本システムは、対象となる映画館の最新上映スケジュールをCORSプロキシ経由で動的に取得し、全上映作品を「MAX方式」でユニーク化して、作品×映画館のマトリクス表形式で直感的に比較・確認できます。

### 特徴
- **リアルタイム動的取得**: スナップショット方式（静的ファイル）ではなく、ブラウザから各映画館の最新情報をオンデマンドで取得。
- **柔軟な設定変更**: `config/cinemas.json` を編集するだけで比較対象の映画館を追加・変更可能。
- **MAX方式での一括比較**: どの映画館でどの作品がどの時間・スクリーンで上映されているかをマトリクス表で網羅。
- **空席情報の確認**: ◎（余裕あり）、◯（予約可能）、△（残りわずか）、×（満席）などのステータス表示および各公式サイト・予約ページヘの直リンクを提供。
- **モダンUI/UX**: ガラスモルフィズムを取り入れたダークモードデザインと完全レスポンシブ表示。

---

## フォルダ構成とファイル説明

```
cinema-schedule-comparison/
├── README.md                    # プロジェクト概要・使い方・構成ドキュメント
├── ISSUES.md                    # Issue管理ドキュメント（RULES.md準拠）
├── prompt/
│   └── prompt.md                # ユーザー要件定義ファイル
├── config/
│   └── cinemas.json             # 比較対象映画館の設定ファイル（名前、URL、抽出ルール等）
├── css/
│   ├── main.css                 # デザインシステム・テーマ変数・ベーススタイル
│   └── components.css           # マトリクス表・空席バッジ・モーダル・フィルターCSS
└── js/
    ├── app.js                   # 全体初期化・コントロール・更新制御
    ├── configLoader.js          # config/cinemas.json の動的読み込みモジュール
    ├── fetchers/
    │   ├── corsProxy.js         # CORSプロキシ経由の通信モジュール
    │   ├── tohoFetcher.js       # TOHOシネマズ（海老名）用データ抽出モジュール
    │   ├── aeonFetcher.js       # イオンシネマ（新百合ヶ丘・座間）用データ抽出モジュール
    │   └── tokyu109Fetcher.js   # 109シネマズ（南町田グランベリーパーク）用データ抽出モジュール
    ├── scheduleUnifier.js       # MAX方式作品タイトルユニーク化・マトリクスデータ統合
    └── uiRender.js              # HTMLマトリクス表および空席モーダルの動的描画
```

### ファイル詳細説明

| ファイル / フォルダ | ステータス | 説明 |
| :--- | :--- | :--- |
| `README.md` | 作成済 | プロジェクトの概要、ディレクトリ構成、各ファイルの説明、利用手順を記載するメインドキュメント。 |
| `ISSUES.md` | 作成済 | `/Users/sizumi/toybox/RULES.md` に基づきプロジェクトマネージャーが管理する全Issue一覧。 |
| `config/cinemas.json` | **[Issue #2] 作成済** | 比較対象の映画館名、URL、識別子、ロゴなどを定義する設定ファイル。 |
| `js/configLoader.js` | **[Issue #2] 作成済** | 外部設定ファイル `config/cinemas.json` を fetch して提供するモジュール。 |
| `js/fetchers/corsProxy.js` | **[Issue #3] 作成済** | CORS制限を回避するためにパブリックプロキシ経由で外部HTML/JSONを動的フェッチするモジュール。 |
| `js/fetchers/tohoFetcher.js` | **[Issue #3] 作成済** | TOHOシネマズ（海老名）用の上映スケジュール・空席動的パースモジュール。 |
| `js/fetchers/aeonFetcher.js` | **[Issue #3] 作成済** | イオンシネマ（新百合ヶ丘・座間）用の上映スケジュール・空席動的パースモジュール。 |
| `js/fetchers/tokyu109Fetcher.js` | **[Issue #3] 作成済** | 109シネマズ（南町田グランベリーパーク）用の上映スケジュール・空席動的パースモジュール。 |
| `js/scheduleUnifier.js` | **[Issue #4] 作成済** | 全映画館のデータを結合し、作品タイトルの名寄せ・ユニーク化（MAX方式）を行ってマトリクス構造を作成するモジュール。 |
| `css/main.css` | 未作成 | 全体デザインシステム、カラーパレット、レスポンシブ変数。 |
| `css/components.css` | 未作成 | 比較マトリクス表、固定タイトル列、空席ステータスバッジ、モーダルのスタイル。 |
| `js/app.js` | 未作成 | ページの初期化、手動リフレッシュイベント、全モジュールの統括。 |
| `js/uiRender.js` | 未作成 | 統合データを基にDOM要素（マトリクス表、空席モーダル）を構築して表示。 |

---

## 初回比較対象の映画館

1. **TOHOシネマズ海老名**: `https://hlo.tohotheater.jp/net/schedule/007/TNPI2000J01.do`
2. **イオンシネマ新百合ヶ丘**: `https://theater.aeoncinema.com/theaters/shinyurigaoka/`
3. **109シネマズ南町田グランベリーパーク**: `https://109cinemas.net/grandberrypark/`
4. **イオンシネマ座間**: `https://www.aeoncinema.com/cinema/zama/`

---

## 開発ルール (`RULES.md` 抜粋)

- Gitブランチ戦略: `main` -> `work` -> `feat/issue-X-...`
- コミット・PRメッセージ: 日本語
- コメントアウト: 日本語で記述
