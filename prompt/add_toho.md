現在の当該機能にTOHOシネマズ海老名のデータを追加して、上映スケジュール比較を作成したい。
# チーム体制
- @RULED.mdに記載したルールに従い、プロジェクトを推進すること
# GitURL
https://github.com/hamburgIzumi/cinema-schedule-comparison.git
# 要件
- 今回追加するのは以下の劇場
    - TOHOシネマズ海老名(https://hlo.tohotheater.jp/net/schedule/007/TNPI2000J01.do)
    なお、TOHOシネマズは以下の印刷ページで各日の上映スケジュールを確認できる
    https://hlo.tohotheater.jp/net/schedule/007/TNPI2160J01.do?site_cd=007&show_day=20260722&_dc=1784678136
    ※show_dayを対象日に設定する
- 空席情報は印刷ページからは不明なので、ブランク表示とする
- 細かな仕様で確定したい箇所、不明な箇所が発生した場合は都度ヒアリングを実施すること
# プロジェクト要件
- 変更内容を都度把握し、README.mdに変更が必要な場合は編集を行うこと
- README.mdはフォルダ構成などファイル説明を記載すること
- ISSUEはチケット起票を行うこと、起票に際してmdファイル等を作成した際は、ISSUEフォルダに保存すること
- 劇場が増えることでデザイン変更を行いたい場合は、変更予定のレイアウトを提案し、承認を得ること