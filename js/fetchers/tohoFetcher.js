/**
 * @file tohoFetcher.js
 * @description TOHOシネマズ（海老名）の上映スケジュールデータを動的に抽出・パースするFetcherモジュール
 */

import { CorsProxyService } from './corsProxy.js';

export class TohoFetcher {
  constructor(cinemaConfig) {
    this.config = cinemaConfig;
    this.corsProxy = new CorsProxyService();
  }

  /**
   * TOHOシネマズの上映スケジュールデータを動的取得・解析する
   * @param {string|Date} targetDate - 取得対象日（文字列 'YYYYMMDD' または Dateオブジェクト）
   * @returns {Promise<Object>} 統一スケジュールデータ構造
   */
  async fetchSchedule(targetDate = new Date()) {
    let dateStr = '';
    let dateObj;

    if (typeof targetDate === 'string') {
      dateStr = targetDate;
      const yyyy = parseInt(targetDate.substring(0, 4), 10);
      const mm = parseInt(targetDate.substring(4, 6), 10) - 1;
      const dd = parseInt(targetDate.substring(6, 8), 10);
      dateObj = new Date(yyyy, mm, dd);
    } else if (targetDate instanceof Date) {
      dateObj = targetDate;
      const yyyy = targetDate.getFullYear();
      const mm = String(targetDate.getMonth() + 1).padStart(2, '0');
      const dd = String(targetDate.getDate()).padStart(2, '0');
      dateStr = `${yyyy}${mm}${dd}`;
    } else {
      dateObj = new Date();
      const yyyy = dateObj.getFullYear();
      const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
      const dd = String(dateObj.getDate()).padStart(2, '0');
      dateStr = `${yyyy}${mm}${dd}`;
    }

    try {
      return await this.fetchScheduleFromHtml(dateObj, dateStr);
    } catch (error) {
      console.warn(`TOHO fetch error for ${this.config.name}:`, error);
      return {
        cinemaId: this.config.id,
        cinemaName: this.config.name,
        targetDate: dateStr,
        fetchedAt: new Date().toISOString(),
        movies: []
      };
    }
  }

  /**
   * hlo.tohotheater.jp の印刷用スケジュールページからHTMLを取得・スクレイピング処理
   */
  async fetchScheduleFromHtml(dateObj, dateStr) {
    let baseUrl = this.config.url || '';
    if (!baseUrl) {
      baseUrl = `https://hlo.tohotheater.jp/net/schedule/${this.config.code || '007'}/TNPI2160J01.do`;
    }
    if (baseUrl.includes('?')) {
      baseUrl = baseUrl.split('?')[0];
    }
    // 劇場コード (site_cd) と上映日 (show_day) を指定
    const targetUrl = `${baseUrl}?site_cd=${this.config.code || '007'}&show_day=${dateStr}`;

    try {
      // Shift_JISでデコードして取得
      const html = await this.corsProxy.fetchHtml(targetUrl, 'shift-jis');
      const doc = this.corsProxy.parseDom(html);

      const movies = [];
      // 各映画ブロックは .movie-box クラスの中に h4 と table が入っている
      const movieBoxes = doc.querySelectorAll('.movie-box');

      if (movieBoxes.length > 0) {
        movieBoxes.forEach(box => {
          const titleEl = box.querySelector('h4');
          if (!titleEl) return;
          let title = titleEl.textContent.trim();

          // 凡例や上映案内などの不要な見出しを除外
          if (title.includes('【上映案内】') || title.includes('【ご案内】') || title.includes('【案内】')) {
            return;
          }

          // 表記揺れ対策: 末尾の / MX4D や / SUB / DUB 等の上映形態指示子を除去
          title = title.replace(/\s*\/\s*(MX4D|IMAX|3D|SUB|DUB|吹替|字幕)\b/gi, '').trim();
          title = title.replace(/\s+/g, ' ').trim();

          const schedules = [];
          // 上映枠が格納されたテーブル
          const screenTables = box.querySelectorAll('table.screen-list');

          screenTables.forEach(table => {
            const rows = table.querySelectorAll('tr');
            rows.forEach(row => {
              const screenEl = row.querySelector('.screen-name');
              if (!screenEl) return;
              const screenName = screenEl.textContent.trim().replace(/\s+/g, ' ');

              // 同じ行のタイムセルをすべて取得
              const timeCells = row.querySelectorAll('.time-cell');
              timeCells.forEach(cell => {
                let cellText = cell.textContent.trim();
                // &nbsp; などの空セルは除外
                if (!cellText || cellText === '\u00a0' || cellText === '') return;

                // 23:00以降の画像等が含まれている場合も考慮して hh:mm-hh:mm 形式を正規表現で抽出
                cellText = cellText.replace(/\s+/g, '').replace(/[\r\n]/g, '');
                const timeMatch = cellText.match(/(\d{1,2}:\d{2})-(\d{1,2}:\d{2})/);
                if (!timeMatch) return;

                const timeRange = timeMatch[0]; // 例: "8:35-11:10"
                const startTime = timeMatch[1]; // 例: "8:35"
                const endTime = timeMatch[2];   // 例: "11:10"

                // タイトルから上映フォーマットを多角的に判定
                let formats = [];
                const lowerTitle = titleEl.textContent.toLowerCase();

                // 1. 上映システム/スクリーンの判定
                if (lowerTitle.includes('mx4d')) formats.push('MX4D');
                else if (lowerTitle.includes('imax')) formats.push('IMAX');
                else if (lowerTitle.includes('3d')) formats.push('3D');

                // 2. 音声・翻訳種別の判定 (印刷用タイトル「OBSESSION / SUB」などの / SUB や / DUB から判定)
                if (lowerTitle.includes('sub') || lowerTitle.includes('字幕')) {
                  formats.push('字幕');
                } else if (lowerTitle.includes('dub') || lowerTitle.includes('吹替')) {
                  formats.push('吹替');
                }

                // formatsが空の場合はデフォルトとして「2D」を設定
                const format = formats.join(' ') || '2D';

                // 空席情報は印刷ページにはないのでブランク表示を設定
                const status = '-';
                const statusText = '空席情報なし';

                // 予約URLは、海老名劇場のメインスケジュールURLを設定
                const reserveUrl = `https://hlo.tohotheater.jp/net/schedule/${this.config.code || '007'}/TNPI2000J01.do`;

                schedules.push({
                  time: timeRange,
                  startTime: startTime,
                  endTime: endTime,
                  screen: screenName,
                  format: format,
                  status: status,
                  statusText: statusText,
                  reserveUrl: reserveUrl
                });
              });
            });
          });

          if (schedules.length > 0) {
            movies.push({ title, schedules });
          }
        });
      }

      return {
        cinemaId: this.config.id,
        cinemaName: this.config.name,
        targetDate: dateStr,
        fetchedAt: new Date().toISOString(),
        movies: movies
      };

    } catch (e) {
      console.error(`TOHO Fetcher error for ${this.config.name}:`, e);
      return {
        cinemaId: this.config.id,
        cinemaName: this.config.name,
        targetDate: dateStr,
        fetchedAt: new Date().toISOString(),
        movies: []
      };
    }
  }
}
