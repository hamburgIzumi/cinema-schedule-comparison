/**
 * @file app.js
 * @description アプリケーション全体の初期化・リアルタイム動的取得（7日間日付選択対応）・イベントハンドリング統括
 */

import { ConfigLoader } from './configLoader.js';
import { TohoFetcher } from './fetchers/tohoFetcher.js';
import { AeonFetcher } from './fetchers/aeonFetcher.js';
import { Tokyu109Fetcher } from './fetchers/tokyu109Fetcher.js';
import { ScheduleUnifier } from './scheduleUnifier.js';
import { UiRender } from './uiRender.js';

class CinemaApp {
  constructor() {
    this.configLoader = new ConfigLoader();
    this.uiRender = new UiRender('matrix-table-container', 'schedule-modal-overlay', 'date-tabs-container');
    this.unifiedData = null;
    this.isFetching = false;
    this.selectedDate = new Date(); // デフォルトは本日
  }

  /**
   * アプリケーションの初期化
   */
  async init() {
    this.setupEventListeners();
    await this.loadAndRender();
  }

  /**
   * イベントリスナーの登録
   */
  setupEventListeners() {
    // 手動リフレッシュボタン
    const refreshBtn = document.getElementById('btn-refresh');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this.loadAndRender(true));
    }

    // 検索入力フィルター
    const searchInput = document.getElementById('movie-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        if (this.unifiedData) {
          this.uiRender.renderMatrixTable(this.unifiedData, e.target.value);
        }
      });
    }

    // モーダル閉じるボタン
    const closeModalBtn = document.getElementById('modal-close-btn');
    if (closeModalBtn) {
      closeModalBtn.addEventListener('click', () => this.uiRender.closeModal());
    }

    // モーダル外側クリックで閉じる
    const modalOverlay = document.getElementById('schedule-modal-overlay');
    if (modalOverlay) {
      modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) {
          this.uiRender.closeModal();
        }
      });
    }
  }

  /**
   * 日付変更時の処理
   * @param {Date} newDate - 選択された新日付
   */
  async onDateSelect(newDate) {
    if (this.isFetching) return;
    this.selectedDate = newDate;
    await this.loadAndRender();
  }

  /**
   * 映画館データの動的フェッチと描画
   * @param {boolean} isManual - 手動リフレッシュか否か
   */
  async loadAndRender(isManual = false) {
    if (this.isFetching) return;
    this.isFetching = true;

    const refreshBtn = document.getElementById('btn-refresh');
    const refreshIcon = refreshBtn?.querySelector('.refresh-icon');
    const statusText = document.getElementById('status-update-time');

    if (refreshIcon) refreshIcon.classList.add('spin');

    // 選択日付のフォーマット
    const month = this.selectedDate.getMonth() + 1;
    const date = this.selectedDate.getDate();
    const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
    const dayStr = dayNames[this.selectedDate.getDay()];
    const dateLabel = `${month}月${date}日(${dayStr})`;

    if (statusText) statusText.textContent = `${dateLabel}のデータを取得中 (CORS動的取得)...`;

    // 1. 日付タブのレンダリング
    this.uiRender.renderDateTabs(this.selectedDate, (newDate) => this.onDateSelect(newDate));

    try {
      // 2. 映画館設定の読み込み
      const cinemaConfigs = await this.configLoader.loadConfig();

      // 3. 各映画館の動的フェッチ（選択日付を指定して並列実行）
      const fetchPromises = cinemaConfigs.map(config => {
        let fetcher;
        switch (config.fetcherType) {
          case 'toho':
            fetcher = new TohoFetcher(config);
            break;
          case 'aeon':
            fetcher = new AeonFetcher(config);
            break;
          case 'tokyu109':
            fetcher = new Tokyu109Fetcher(config);
            break;
          default:
            fetcher = new AeonFetcher(config);
        }
        return fetcher.fetchSchedule(this.selectedDate);
      });

      const cinemaSchedules = await Promise.all(fetchPromises);

      // 4. MAX方式による作品タイトルユニーク化＆マトリクス構造化
      this.unifiedData = ScheduleUnifier.unifySchedules(cinemaSchedules, cinemaConfigs);

      // 5. マトリクス表の描画
      const searchInput = document.getElementById('movie-search-input');
      const filterText = searchInput ? searchInput.value : '';
      this.uiRender.renderMatrixTable(this.unifiedData, filterText);

      // デモ（ダミー）データが含まれているか検証
      const hasFallback = this.unifiedData.cinemas.some(c => c.isFallback);

      // 最終更新表示
      const now = new Date();
      const timeStr = now.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      if (statusText) {
        if (hasFallback) {
          statusText.innerHTML = `<span style="color: #fbbf24; font-weight: 600;">⚠️ 表示中: ${dateLabel} | 【一部デモ（ダミー）データ表示中】 (最終更新: ${timeStr})</span>`;
        } else {
          statusText.textContent = `表示中: ${dateLabel} | 最終更新: ${timeStr} (リアルタイム実データ取得完了)`;
        }
      }

    } catch (error) {
      console.error('App load error:', error);
      if (statusText) statusText.textContent = 'データ取得に失敗しました。';
    } finally {
      this.isFetching = false;
      if (refreshIcon) refreshIcon.classList.remove('spin');
    }
  }
}

// 画面読込完了時にアプリ起動
document.addEventListener('DOMContentLoaded', () => {
  const app = new CinemaApp();
  app.init();
});
