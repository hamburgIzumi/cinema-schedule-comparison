ウェブで確認できる、映画館の上映スケジュール比較を作成したい。
# チーム体制
- @RULED.mdに記載したルールに従い、プロジェクトを推進すること
# GitURL
https://github.com/hamburgIzumi/cinema-schedule-comparison.git
# 要件
- GitHubPagesなど、無料で利用可能なサービスを使ってサイト公開をする
- 比較する映画館（URLなど）は設定ファイルで変更可能
    - 初回は以下の映画館
    - TOHOシネマズ海老名(https://hlo.tohotheater.jp/net/schedule/007/TNPI2000J01.do)
    - イオンシネマ新百合ヶ丘(https://theater.aeoncinema.com/theaters/shinyurigaoka/?_gl=1*uk6ukv*_gcl_au*MTQxMjAyMDE4NC4xNzg0NTM4MDkz)
    - 109シネマズ南町田グランベリーパーク：https://109cinemas.net/grandberrypark/
    - イオンシネマ座間(https://www.aeoncinema.com/cinema/zama/)
- 上映作品はMAX方式で対象の映画館から取得した映画館をユニークにしたうえで表形式で表示する
- 空席情報など、Webサイトから紹介できる内容も確認できるようにする
- 細かな仕様で確定したい箇所、不明な箇所が発生した場合は都度ヒアリングを実施すること
- snapshot方式での静的表示ではなく、動的に取得する方針が望ましい
# プロジェクト要件
- 変更内容を都度把握し、README.mdに変更が必要な場合は編集を行うこと
- README.mdはフォルダ構成などファイル説明を記載すること
- ISSUEはチケット起票を行うこと、起票に際してmdファイル等を作成した際は、ISSUEフォルダに保存すること