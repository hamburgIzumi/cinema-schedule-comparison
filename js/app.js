/**
 * @file app.js
 * @description イオンシネマ比較アプリのメインエントリーポイント (最小構成)
 */

import { AeonFetcher } from './fetchers/aeonFetcher.js';
import { ScheduleUnifier } from './scheduleUnifier.js';
import { UIRender } from './uiRender.js';

class CinemaApp {
  constructor() {
    this.cinemasConfig = [];
    this.fetchers = [];
    this.scheduleUnifier = new ScheduleUnifier();
    this.uiRender = new UIRender('matrix-table-container', 'schedule-modal-overlay', 'date-tabs-container');

    this.selectedDate = this.getTodayDateString();
    this.unifiedData = null;
  }

  getTodayDateString() {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}${mm}${dd}`;
  }

  async init() {
    try {
      this.uiRender.renderSkeleton();

      const response = await fetch('./config/cinemas.json');
      if (!response.ok) {
        throw new Error('設定ファイル (config/cinemas.json) の読み込みに失敗しました。');
      }

      this.cinemasConfig = await response.json();
      this.initializeFetchers();
      this.setupEventListeners();

      // 日付選択タブのレンダリング
      const selectedDateObj = this.parseDateString(this.selectedDate);
      this.uiRender.renderDateTabs(selectedDateObj, (newDateObj) => {
        const yyyy = newDateObj.getFullYear();
        const mm = String(newDateObj.getMonth() + 1).padStart(2, '0');
        const dd = String(newDateObj.getDate()).padStart(2, '0');
        this.selectedDate = `${yyyy}${mm}${dd}`;
        this.loadSchedules();
      });

      await this.loadSchedules();

    } catch (error) {
      console.error('アプリ初期化エラー:', error);
      this.uiRender.renderError('初期化エラー', error.message);
    }
  }

  parseDateString(dateStr) {
    const yyyy = parseInt(dateStr.substring(0, 4), 10);
    const mm = parseInt(dateStr.substring(4, 6), 10) - 1;
    const dd = parseInt(dateStr.substring(6, 8), 10);
    return new Date(yyyy, mm, dd);
  }

  initializeFetchers() {
    this.fetchers = this.cinemasConfig.map(config => new AeonFetcher(config));
  }

  setupEventListeners() {
    // btn-refresh または refresh-btn の両対応
    const refreshBtn = document.getElementById('btn-refresh') || document.getElementById('refresh-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        this.loadSchedules();
      });
    }

    // movie-search-input または search-movie-input の両対応
    const searchInput = document.getElementById('movie-search-input') || document.getElementById('search-movie-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        if (this.unifiedData) {
          this.uiRender.renderMatrixTable(this.unifiedData, e.target.value);
        }
      });
    }
  }

  async loadSchedules() {
    this.uiRender.renderSkeleton();
    const statusText = document.getElementById('status-update-time') || document.getElementById('status-text');
    if (statusText) {
      statusText.textContent = '最新の上映スケジュールを取得中...';
    }

    try {
      const fetchPromises = this.fetchers.map(fetcher => fetcher.fetchSchedule(this.selectedDate));
      const cinemaSchedules = await Promise.all(fetchPromises);

      this.unifiedData = this.scheduleUnifier.unify(this.cinemasConfig, cinemaSchedules, this.selectedDate);

      const searchInput = document.getElementById('movie-search-input') || document.getElementById('search-movie-input');
      const filterText = searchInput ? searchInput.value : '';
      this.uiRender.renderMatrixTable(this.unifiedData, filterText);

      const now = new Date();
      const timeStr = now.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const year = this.selectedDate.substring(0, 4);
      const month = this.selectedDate.substring(4, 6);
      const day = this.selectedDate.substring(6, 8);
      const dateLabel = `${year}年${month}月${day}日`;

      if (statusText) {
        statusText.textContent = `表示中: ${dateLabel} | 最終更新: ${timeStr}`;
      }

    } catch (error) {
      console.error('スケジュール読み込みエラー:', error);
      this.uiRender.renderError('データ取得エラー', 'スケジュールの読み込みに失敗しました。');
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const app = new CinemaApp();
  app.init();
});
