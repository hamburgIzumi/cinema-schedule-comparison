/**
 * @file aeonFetcher.js
 * @description イオンシネマ（新百合ヶ丘・座間: theater.aeoncinema.com）の上映スケジュール・空席データを動的に抽出・パースするモジュール
 */

import { CorsProxyService } from './corsProxy.js';

export class AeonFetcher {
  constructor(cinemaConfig) {
    this.config = cinemaConfig;
    this.corsProxy = new CorsProxyService();
  }

  /**
   * イオンシネマの上映スケジュールデータを動的取得・解析する
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

    // 優先度0: Cloudflare Workers リアルタイムプロキシAPIが設定されている場合
    if (this.config.workersApiUrl) {
      try {
        const workersData = await this.corsProxy.fetchFromWorkersApi(this.config.workersApiUrl, this.config.id, dateStr);
        if (workersData && workersData.movies && workersData.movies.length > 0) {
          return workersData;
        }
      } catch (e) {
        console.warn(`AEON Workers API fetch failed for ${this.config.name}:`, e);
      }
    }

    try {
      return await this.fetchScheduleFromHtml(dateObj, dateStr);
    } catch (error) {
      console.warn(`AEON fetch error for ${this.config.name}:`, error);
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
   * theater.aeoncinema.com からのHTML直接スクレイピング処理
   */
  async fetchScheduleFromHtml(dateObj, dateStr) {
    let baseUrl = this.config.url || this.config.siteUrl || '';
    if (baseUrl.includes('?')) {
      baseUrl = baseUrl.split('?')[0];
    }
    const targetUrl = `${baseUrl}?date=${dateStr}`;

    try {
      const html = await this.corsProxy.fetchHtml(targetUrl);
      const doc = this.corsProxy.parseDom(html);

      const movies = [];
      const movieElements = doc.querySelectorAll('.movie_box, .schedule_box, .movie-item, .movie-box, .schedule-movie-list > div, section.movie');

      if (movieElements.length > 0) {
        movieElements.forEach(el => {
          const titleEl = el.querySelector('.movie_title, .title, h3, .movie-name, .movie-title, .name');
          if (!titleEl) return;
          const title = titleEl.textContent.trim();

          const schedules = [];
          const timeBoxes = el.querySelectorAll('.time_box, .time-item, .time_table tr, .schedule-time-item, .time-box, li.time');

          timeBoxes.forEach(box => {
            const timeText = box.querySelector('.time, .start, .time-start, .start-time')?.textContent.trim() || box.textContent.trim();
            const statusText = box.querySelector('.seat, .status, .icon, .seat-status')?.textContent.trim() || '◯';

            let status = '◯';
            if (statusText.includes('◎') || statusText.includes('余裕') || statusText.includes('空席あり')) status = '◎';
            else if (statusText.includes('△') || statusText.includes('わずか') || statusText.includes('残りわずか')) status = '△';
            else if (statusText.includes('×') || statusText.includes('満席') || statusText.includes('完売')) status = '×';

            const reserveUrl = box.querySelector('a')?.href || this.config.siteUrl;

            if (timeText && timeText.length >= 4) {
              schedules.push({
                time: timeText,
                startTime: timeText.substring(0, 5),
                endTime: timeText.length > 5 ? timeText.substring(6) : '',
                screen: box.querySelector('.screen_name, .screen, .screen-name')?.textContent.trim() || 'スクリーン 1',
                format: box.querySelector('.format, .type')?.textContent.trim() || '2D',
                status: status,
                statusText: statusText || '予約可能',
                reserveUrl: reserveUrl
              });
            }
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
