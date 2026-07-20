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
    this.uiRender = new UIRender();

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

      this.uiRender.renderDateSelector(this.selectedDate, (newDate) => {
        this.selectedDate = newDate;
        this.loadSchedules();
      });

      await this.loadSchedules();

    } catch (error) {
      console.error('アプリ初期化エラー:', error);
      this.uiRender.renderError('初期化エラー', error.message);
    }
  }

  initializeFetchers() {
    this.fetchers = this.cinemasConfig.map(config => new AeonFetcher(config));
  }

  setupEventListeners() {
    const refreshBtn = document.getElementById('refresh-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        this.loadSchedules();
      });
    }

    const searchInput = document.getElementById('search-movie-input');
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
    const statusText = document.getElementById('status-text');
    if (statusText) {
      statusText.textContent = '最新の上映スケジュールを取得中...';
    }

    try {
      const fetchPromises = this.fetchers.map(fetcher => fetcher.fetchSchedule(this.selectedDate));
      const cinemaSchedules = await Promise.all(fetchPromises);

      this.unifiedData = this.scheduleUnifier.unify(this.cinemasConfig, cinemaSchedules, this.selectedDate);

      const searchInput = document.getElementById('search-movie-input');
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
