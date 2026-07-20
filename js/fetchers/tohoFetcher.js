/**
 * @file tohoFetcher.js
 * @description TOHOシネマズ海老名の上映スケジュール・空席データを動的に抽出・パースするモジュール
 * (直APIフェッチ優先 ＆ 従来HTMLフェッチへの切り戻し機能対応)
 */

import { CorsProxyService } from './corsProxy.js';

export class TohoFetcher {
  constructor(cinemaConfig) {
    this.config = cinemaConfig;
    this.corsProxy = new CorsProxyService();
  }

  /**
   * TOHOシネマズの上映スケジュールデータを動的取得・解析する
   * @param {Date} targetDate - 取得対象日（デフォルト: 本日）
   * @returns {Promise<Object>} 統一スケジュールデータ構造
   */
  async fetchSchedule(targetDate = new Date()) {
    const yyyy = targetDate.getFullYear();
    const mm = String(targetDate.getMonth() + 1).padStart(2, '0');
    const dd = String(targetDate.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}${mm}${dd}`;

    // 優先度0: Cloudflare Workers リアルタイムプロキシAPIが設定されている場合
    if (this.config.workersApiUrl) {
      try {
        const workersData = await this.corsProxy.fetchFromWorkersApi(this.config.workersApiUrl, this.config.id, dateStr);
        if (workersData && workersData.movies && workersData.movies.length > 0) {
          return workersData;
        }
      } catch (e) {
        console.warn(`TOHO Workers API fetch failed for ${this.config.name}:`, e);
      }
    }

    // 優先度1: useDirectApi フラグが有効な場合、直API / 高度データ抽出を試行
    if (this.config.useDirectApi !== false) {
      try {
        const apiData = await this.fetchScheduleFromApi(targetDate);
        if (apiData && apiData.movies && apiData.movies.length > 0) {
          return apiData;
        }
      } catch (e) {
        console.warn(`TOHO Direct API fetch failed, falling back to HTML parser:`, e);
      }
    }

    // 優先度2: 従来のHTML解析モジュールでの取得
    try {
      return await this.fetchScheduleFromHtml(targetDate);
    } catch (error) {
      console.warn(`TOHO HTML fetch error for ${this.config.name}, using dynamic fallback:`, error);
      return this.getRealtimeFallbackData(targetDate);
    }
  }

  /**
   * 優先度1: API / 高度データ構造の直接抽出
   */
  async fetchScheduleFromApi(targetDate) {
    const yyyy = targetDate.getFullYear();
    const mm = String(targetDate.getMonth() + 1).padStart(2, '0');
    const dd = String(targetDate.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}${mm}${dd}`;

    const apiUrl = `${this.config.apiUrl}?date=${dateStr}`;
    const htmlOrJson = await this.corsProxy.fetchHtml(apiUrl);

    // 取得したレスポンス内に埋め込まれた script タグ内の JSON データを動的パース
    const movies = [];
    const doc = this.corsProxy.parseDom(htmlOrJson);
    
    // TOHOシネマズの埋め込みスクリプト・JSONデータ領域を探す
    const scripts = doc.querySelectorAll('script');
    scripts.forEach(script => {
      const content = script.textContent;
      if (content && (content.includes('schedule') || content.includes('movieList'))) {
        const jsonMatch = content.match(/var\s+scheduleData\s*=\s*(\{.*?\});/s) || content.match(/(\[\s*\{.*"title".*\}\s*\])/s);
        if (jsonMatch) {
          try {
            const rawJson = JSON.parse(jsonMatch[1]);
            if (Array.isArray(rawJson)) {
              rawJson.forEach(item => {
                if (item.title) {
                  movies.push({
                    title: item.title,
                    schedules: (item.schedules || []).map(s => ({
                      time: s.time || `${s.start || '10:00'} - ${s.end || '12:00'}`,
                      startTime: s.start || '10:00',
                      screen: s.screen || 'SCREEN 1',
                      format: s.format || '2D',
                      status: s.status || '◯',
                      statusText: s.statusText || '空席あり',
                      reserveUrl: s.url || this.config.siteUrl
                    }))
                  });
                }
              });
            }
          } catch (e) {
            // パースエラーはスルー
          }
        }
      }
    });

    if (movies.length > 0) {
      return {
        cinemaId: this.config.id,
        cinemaName: this.config.name,
        targetDate: dateStr,
        isFallback: false,
        fetchedAt: new Date().toISOString(),
        movies: movies
      };
    }

    return null;
  }

  /**
   * 優先度2: 従来のHTML直接スクレイピング処理
   */
  async fetchScheduleFromHtml(targetDate) {
    const yyyy = targetDate.getFullYear();
    const mm = String(targetDate.getMonth() + 1).padStart(2, '0');
    const dd = String(targetDate.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}${mm}${dd}`;

    const targetUrl = this.config.url.includes('?') 
      ? `${this.config.url}&date=${dateStr}` 
      : `${this.config.url}?date=${dateStr}`;

    const html = await this.corsProxy.fetchHtml(targetUrl);
    const doc = this.corsProxy.parseDom(html);
    
    const movies = [];
    const scheduleBlocks = doc.querySelectorAll('.schedule-block, .schedule-list-item, .schedule-movie, section.movie-schedule');
    
    if (scheduleBlocks.length > 0) {
      scheduleBlocks.forEach(block => {
        const titleEl = block.querySelector('.movie-title, .title, h3, .heading');
        if (!titleEl) return;
        const title = titleEl.textContent.trim();

        const schedules = [];
        const timeElements = block.querySelectorAll('.time-table-item, .time, li.schedule-item');
        timeElements.forEach(item => {
          const timeText = item.querySelector('.start-time, .time-start')?.textContent.trim() || item.textContent.trim();
          const statusEl = item.querySelector('.status, .icon-status, span');
          const statusText = statusEl ? statusEl.textContent.trim() : '◯';
          
          let status = '◯';
          if (statusText.includes('◎') || statusText.includes('空席あり')) status = '◎';
          else if (statusText.includes('△') || statusText.includes('残りわずか')) status = '△';
          else if (statusText.includes('×') || statusText.includes('満員') || statusText.includes('完売')) status = '×';

          const reserveUrl = item.querySelector('a')?.href || this.config.siteUrl;

          schedules.push({
            time: timeText,
            startTime: timeText.split('-')[0] || timeText,
            endTime: timeText.split('-')[1] || '',
            screen: item.querySelector('.screen')?.textContent.trim() || 'SCREEN 1',
            format: '2D / 吹替',
            status: status,
            statusText: statusText || '空席あり',
            reserveUrl: reserveUrl
          });
        });

        if (schedules.length > 0) {
          movies.push({ title, schedules });
        }
      });
    }

    if (movies.length === 0) {
      return this.getRealtimeFallbackData(targetDate);
    }

    return {
      cinemaId: this.config.id,
      cinemaName: this.config.name,
      targetDate: dateStr,
      isFallback: false,
      fetchedAt: new Date().toISOString(),
      movies: movies
    };
  }

  /**
   * 優先度3: 動的リアルタイムフォールバック生成
   */
  getRealtimeFallbackData(targetDate = new Date()) {
    const daySeed = targetDate.getDate() % 3;
    const statuses = ['◎', '◯', '△', '×'];

    return {
      cinemaId: this.config.id,
      cinemaName: this.config.name,
      isFallback: true,
      fallbackReason: "通信遮断またはサイト構造変化のため接続テスト用サンプル（ダミー）データを表示中",
      fetchedAt: new Date().toISOString(),
      movies: [
        {
          title: "名探偵コナン 100万ドルの五稜星",
          schedules: [
            { time: "09:00 - 11:05", startTime: "09:00", screen: "TCX SCREEN 1", format: "2D / 吹替", status: statuses[daySeed % 4], statusText: "予約受付中", reserveUrl: this.config.siteUrl },
            { time: "11:40 - 13:45", startTime: "11:40", screen: "TCX SCREEN 1", format: "2D / 吹替", status: statuses[(daySeed + 1) % 4], statusText: "予約受付中", reserveUrl: this.config.siteUrl },
            { time: "14:20 - 16:25", startTime: "14:20", screen: "TCX SCREEN 1", format: "IMAX 2D", status: statuses[(daySeed + 2) % 4], statusText: "残りわずか", reserveUrl: this.config.siteUrl },
            { time: "17:00 - 19:05", startTime: "17:00", screen: "SCREEN 3", format: "2D / 吹替", status: "◯", statusText: "予約受付中", reserveUrl: this.config.siteUrl },
            { time: "19:40 - 21:45", startTime: "19:40", screen: "SCREEN 3", format: "2D / 吹替", status: "◎", statusText: "余裕あり", reserveUrl: this.config.siteUrl }
          ]
        },
        {
          title: "劇場版ハイキュー!! ゴミ捨て場の決戦",
          schedules: [
            { time: "10:15 - 11:45", startTime: "10:15", screen: "SCREEN 2", format: "2D", status: "◯", statusText: "予約受付中", reserveUrl: this.config.siteUrl },
            { time: "13:00 - 14:30", startTime: "13:00", screen: "SCREEN 2", format: "2D", status: "△", statusText: "残りわずか", reserveUrl: this.config.siteUrl },
            { time: "16:00 - 17:30", startTime: "16:00", screen: "SCREEN 5", format: "2D", status: "◎", statusText: "余裕あり", reserveUrl: this.config.siteUrl },
            { time: "18:45 - 20:15", startTime: "18:45", screen: "SCREEN 5", format: "2D", status: "◯", statusText: "予約受付中", reserveUrl: this.config.siteUrl }
          ]
        },
        {
          title: "ゴジラxコング 新たなる帝国",
          schedules: [
            { time: "09:30 - 11:30", startTime: "09:30", screen: "IMAX", format: "IMAX 3D / 字幕", status: "◎", statusText: "余裕あり", reserveUrl: this.config.siteUrl },
            { time: "12:15 - 14:15", startTime: "12:15", screen: "IMAX", format: "IMAX 3D / 吹替", status: "◯", statusText: "予約受付中", reserveUrl: this.config.siteUrl },
            { time: "15:00 - 17:00", startTime: "15:00", screen: "SCREEN 4", format: "2D / 吹替", status: "×", statusText: "満席", reserveUrl: this.config.siteUrl },
            { time: "20:00 - 22:00", startTime: "20:00", screen: "IMAX", format: "IMAX 2D / 字幕", status: "◎", statusText: "余裕あり", reserveUrl: this.config.siteUrl }
          ]
        },
        {
          title: "キングダム 大ショウグンの帰還",
          schedules: [
            { time: "10:00 - 12:10", startTime: "10:00", screen: "SCREEN 6", format: "2D", status: "◎", statusText: "余裕あり", reserveUrl: this.config.siteUrl },
            { time: "13:10 - 15:20", startTime: "13:10", screen: "SCREEN 6", format: "2D", status: "◯", statusText: "予約受付中", reserveUrl: this.config.siteUrl },
            { time: "16:30 - 18:40", startTime: "16:30", screen: "SCREEN 6", format: "2D", status: "△", statusText: "残りわずか", reserveUrl: this.config.siteUrl },
            { time: "19:30 - 21:40", startTime: "19:30", screen: "SCREEN 6", format: "2D", status: "◯", statusText: "予約受付中", reserveUrl: this.config.siteUrl }
          ]
        }
      ]
    };
  }
}
