/**
 * @file 109Fetcher.js
 * @description 109シネマズ（グランベリーパーク）の上映スケジュールデータを動的に抽出・パースするFetcherモジュール
 */

import { CorsProxyService } from './corsProxy.js';

export class Cinema109Fetcher {
  constructor(cinemaConfig) {
    this.config = cinemaConfig;
    this.corsProxy = new CorsProxyService();
  }

  /**
   * 109シネマズの上映スケジュールデータを動的取得・解析する
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
      console.warn(`109 fetch error for ${this.config.name}:`, error);
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
   * 109cinemas.net の上映スケジュールページからHTMLを取得・スクレイピング処理
   */
  async fetchScheduleFromHtml(dateObj, dateStr) {
    let baseUrl = this.config.url || '';
    if (!baseUrl) {
      baseUrl = 'https://109cinemas.net/grandberrypark/schedules/';
    }
    // 末尾にスラッシュがない場合は追加
    if (!baseUrl.endsWith('/')) {
      baseUrl += '/';
    }
    
    // HTMLのファイル名を指定
    const targetUrl = `${baseUrl}${dateStr}.html?theater_code=${this.config.code || 'G1'}&_=${Date.now()}`;

    try {
      // UTF-8でデコードして取得
      const html = await this.corsProxy.fetchHtml(targetUrl, 'utf-8');
      const doc = this.corsProxy.parseDom(html);

      const movies = [];
      const articles = doc.querySelectorAll('#timetable article');

      articles.forEach(article => {
        const headerEl = article.querySelector('header h2');
        if (!headerEl) return;
        const title = headerEl.textContent.trim();

        const schedules = [];
        // 各スクリーンごとのスケジュールテーブル (ul.timetable) をループ
        const timetables = article.querySelectorAll('ul.timetable');

        timetables.forEach(timetable => {
          // スクリーン情報を取得 (li.theatre)
          const theatreEl = timetable.querySelector('li.theatre');
          if (!theatreEl) return;

          // シアター名 (例: シアター10)
          const theatreNumEl = theatreEl.querySelector('.theatre-num');
          const theatreNum = theatreNumEl ? theatreNumEl.textContent.trim() : '';
          const screenName = `シアター${theatreNum}`;

          // 上映方式/音響等の抽出 (theatreElの直下のテキストノードから抽出)
          let formats = [];
          const text = theatreEl.textContent || '';
          
          if (text.includes('IMAX')) formats.push('IMAX');
          else if (text.includes('4DX')) formats.push('4DX');
          else if (text.includes('SAION')) formats.push('SAION');
          else if (text.includes('3D')) formats.push('3D');
          
          if (formats.length === 0) {
            formats.push('2D');
          }

          // 映画タイトルから吹替・字幕を判定
          const lowerTitle = title.toLowerCase();
          if (lowerTitle.includes('字幕')) {
            formats.push('字幕');
          } else if (lowerTitle.includes('吹替')) {
            formats.push('吹替');
          }

          const format = formats.join(' ');

          // 各上映回 (li.check_date) をループ
          const showCells = timetable.querySelectorAll('li.check_date');
          showCells.forEach(cell => {
            const startEl = cell.querySelector('.start');
            const endEl = cell.querySelector('.end');
            if (!startEl || !endEl) return;

            const startTime = startEl.textContent.trim();
            const endTime = endEl.textContent.trim();
            const timeRange = `${startTime}-${endTime}`;

            // 予約リンク（メンテナンス中などでaタグがない場合は公式サイトURLをフォールバックにする）
            const linkEl = cell.querySelector('a');
            const reserveUrl = linkEl ? linkEl.getAttribute('href') : (this.config.siteUrl || 'https://109cinemas.net/grandberrypark/');

            // 空き状況の判定
            let status = '-';
            let statusText = '不明';

            const availableEl = cell.querySelector('.available');
            const remainingEl = cell.querySelector('.remaining');
            const soldoutEl = cell.querySelector('.soldout');
            
            if (availableEl) {
              status = '◎';
              statusText = '空席あり';
            } else if (remainingEl) {
              status = '△';
              statusText = '残りわずか';
            } else if (soldoutEl) {
              status = '×';
              statusText = '完売';
            }

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

        if (schedules.length > 0) {
          movies.push({ title, schedules });
        }
      });

      return {
        cinemaId: this.config.id,
        cinemaName: this.config.name,
        targetDate: dateStr,
        fetchedAt: new Date().toISOString(),
        movies: movies
      };

    } catch (e) {
      console.error(`109 Fetcher error for ${this.config.name}:`, e);
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
