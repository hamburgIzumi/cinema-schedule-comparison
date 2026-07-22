/**
 * @file uiRender.js
 * @description マトリクス比較表のレンダリング、検索フィルター、詳細モーダル表示を行うUI制御モジュール
 */

export class UIRender {
  constructor(tableContainerId = 'table-container', modalOverlayId = 'modal-overlay', dateTabsContainerId = 'date-tabs-container') {
    this.tableContainer = document.getElementById(tableContainerId);
    this.modalOverlay = document.getElementById(modalOverlayId);
    this.dateTabsContainer = document.getElementById(dateTabsContainerId);

    // モーダルの閉じるイベント（✕ボタン、背景クリック、Escキー）の自動セットアップ
    this.setupModalEvents();
  }

  /**
   * モーダル閉じるイベントハンドラーの設定
   */
  setupModalEvents() {
    if (!this.modalOverlay) return;

    // ✕ ボタンのクリック
    const closeBtn = document.getElementById('modal-close-btn') || this.modalOverlay.querySelector('.modal-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.closeModal();
      });
    }

    // モーダル背景領域（オーバーレイ）のクリック
    this.modalOverlay.addEventListener('click', (e) => {
      if (e.target === this.modalOverlay) {
        this.closeModal();
      }
    });

    // キーボード Esc キーの押し下げ
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' || e.key === 'Esc') {
        if (this.modalOverlay.classList.contains('active')) {
          this.closeModal();
        }
      }
    });
  }

  /**
   * ローディングスケルトンをレンダリングする
   */
  renderSkeleton() {
    if (!this.tableContainer) return;
    this.tableContainer.innerHTML = `
      <div class="skeleton-loader" style="text-align: center; padding: 40px;">
        <div class="spinner" style="font-size: 2rem; margin-bottom: 15px;">⏳</div>
        <p style="color: var(--text-secondary, #94a3b8);">最新の上映スケジュール・空席状況を取得中...</p>
      </div>
    `;
  }

  /**
   * エラーメッセージをレンダリングする
   */
  renderError(title, message) {
    if (!this.tableContainer) return;
    this.tableContainer.innerHTML = `
      <div class="error-box" style="text-align: center; padding: 40px; color: #ef4444;">
        <div style="font-size: 2rem; margin-bottom: 10px;">⚠️ ${this.escapeHtml(title)}</div>
        <p>${this.escapeHtml(message)}</p>
      </div>
    `;
  }

  /**
   * 日付選択ナビゲーション (日付タブ / renderDateSelector 互換)
   */
  renderDateSelector(selectedDateStr, onDateSelectCallback) {
    if (!this.dateTabsContainer) return;

    const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let html = '';

    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);

      const yyyy = d.getFullYear();
      const mmStr = String(d.getMonth() + 1).padStart(2, '0');
      const ddStr = String(d.getDate()).padStart(2, '0');
      const dateStr = `${yyyy}${mmStr}${ddStr}`;

      const isSelected = dateStr === selectedDateStr;
      const dayOfWeek = d.getDay();
      const month = d.getMonth() + 1;
      const dateNum = d.getDate();

      let dayClass = '';
      if (dayOfWeek === 6) dayClass = 'sat';
      if (dayOfWeek === 0) dayClass = 'sun';

      let labelText = `${month}/${dateNum}`;
      let dayLabel = `${dayNames[dayOfWeek]}`;
      if (i === 0) dayLabel = '本日';
      else if (i === 1) dayLabel = '明日';

      html += `
        <div class="date-tab-item ${dayClass} ${isSelected ? 'active' : ''}" data-datestr="${dateStr}">
          <span class="date-tab-day">${dayLabel}</span>
          <span class="date-tab-date">${labelText} (${dayNames[dayOfWeek]})</span>
        </div>
      `;
    }

    this.dateTabsContainer.innerHTML = html;

    const tabItems = this.dateTabsContainer.querySelectorAll('.date-tab-item');
    tabItems.forEach(item => {
      item.addEventListener('click', () => {
        const dateStr = item.dataset.datestr;
        if (onDateSelectCallback) {
          onDateSelectCallback(dateStr);
        }
      });
    });
  }

  /**
   * 当日を含む7日間の日付ナビゲーションタブをレンダリングする (Dateオブジェクト対応互換)
   */
  renderDateTabs(selectedDate, onDateSelectCallback) {
    const yyyy = selectedDate.getFullYear();
    const mmStr = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const ddStr = String(selectedDate.getDate()).padStart(2, '0');
    const selectedDateStr = `${yyyy}${mmStr}${ddStr}`;

    this.renderDateSelector(selectedDateStr, (newDateStr) => {
      const year = parseInt(newDateStr.substring(0, 4), 10);
      const month = parseInt(newDateStr.substring(4, 6), 10) - 1;
      const day = parseInt(newDateStr.substring(6, 8), 10);
      if (onDateSelectCallback) {
        onDateSelectCallback(new Date(year, month, day));
      }
    });
  }

  /**
   * クラス操作（classList）によってアクティブな日付タブ表示を切り替える
   * @param {string} selectedDateStr - YYYYMMDD形式の選択日付
   */
  updateActiveDateTab(selectedDateStr) {
    if (!this.dateTabsContainer) return;
    const tabItems = this.dateTabsContainer.querySelectorAll('.date-tab-item');
    tabItems.forEach(item => {
      if (item.dataset.datestr === selectedDateStr) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });
  }

  /**
   * 統合マトリクスデータから比較表HTMLを動的レンダリングする
   */
  renderMatrixTable(unifiedData, filterText = '') {
    if (!this.tableContainer) return;

    const { cinemas, matrix } = unifiedData;
    const lowerFilter = filterText.toLowerCase().trim();

    const filteredMatrix = matrix.filter(row => {
      if (!lowerFilter) return true;
      return row.title.toLowerCase().includes(lowerFilter);
    });

    if (filteredMatrix.length === 0) {
      this.tableContainer.innerHTML = `
        <div class="no-schedule" style="text-align: center; padding: 40px; color: var(--text-secondary, #94a3b8);">
          該当する映画作品が見つかりませんでした。
        </div>
      `;
      return;
    }

    let html = `
      <table class="matrix-table" id="comparison-table">
        <thead>
          <tr>
            <th class="col-movie-title">上映作品 (全${filteredMatrix.length}作品)</th>
    `;

    cinemas.forEach(cinema => {
      html += `
        <th>
          <div class="cinema-header-cell">
            <span class="cinema-name">${this.escapeHtml(cinema.name)}</span>
            <span class="cinema-brand-badge" style="border-left: 3px solid ${cinema.color || '#4facfe'}">
              <a href="${cinema.siteUrl}" target="_blank" rel="noopener noreferrer" style="color: inherit; text-decoration: none;">
                ${cinema.shortName || cinema.name} 🔗
              </a>
            </span>
          </div>
        </th>
      `;
    });

    html += `
          </tr>
        </thead>
        <tbody>
    `;

    filteredMatrix.forEach(row => {
      html += `
        <tr>
          <td class="col-movie-title">
            <span class="movie-title-text">${this.escapeHtml(row.title)}</span>
          </td>
      `;

      cinemas.forEach(cinema => {
        const schedules = row.cinemaSchedules[cinema.id] || [];

        html += `<td>`;

        if (schedules.length === 0) {
          html += `<div class="no-schedule">-</div>`;
        } else {
          html += `<div class="schedule-cell-list">`;
          schedules.forEach(sched => {
            const badgeClass = this.getStatusBadgeClass(sched.status);
            html += `
              <div class="schedule-item-card" data-cinema="${this.escapeHtml(cinema.name)}" data-movie="${this.escapeHtml(row.title)}" data-time="${this.escapeHtml(sched.time)}" data-screen="${this.escapeHtml(sched.screen)}" data-format="${this.escapeHtml(sched.format)}" data-status="${this.escapeHtml(sched.statusText)}" data-url="${this.escapeHtml(sched.reserveUrl)}">
                <div>
                  <div class="schedule-time">${this.escapeHtml(sched.time)}</div>
                  <span class="schedule-format">${this.escapeHtml(sched.format || '')}</span>
                </div>
                <span class="status-badge ${badgeClass}">${sched.status}</span>
              </div>
            `;
          });
          html += `</div>`;
        }

        html += `</td>`;
      });

      html += `</tr>`;
    });

    html += `
        </tbody>
      </table>
    `;

    this.tableContainer.innerHTML = html;
    this.attachCardEventListeners();
  }

  getStatusBadgeClass(status) {
    switch (status) {
      case '◎': return 'status-plenty';
      case '◯': return 'status-available';
      case '△': return 'status-few';
      case '×': return 'status-full';
      case '-': return 'status-none'; // 空席情報なし（TOHOシネマズ印刷用ページ対応）
      default: return 'status-available';
    }
  }

  attachCardEventListeners() {
    const cards = this.tableContainer.querySelectorAll('.schedule-item-card');
    cards.forEach(card => {
      card.addEventListener('click', () => {
        const data = {
          cinema: card.dataset.cinema,
          movie: card.dataset.movie,
          time: card.dataset.time,
          screen: card.dataset.screen,
          format: card.dataset.format,
          status: card.dataset.status,
          url: card.dataset.url
        };
        this.openModal(data);
      });
    });
  }

  openModal(data) {
    if (!this.modalOverlay) return;

    const modalCinemaName = document.getElementById('modal-cinema-name');
    const modalMovieTitle = document.getElementById('modal-movie-title');
    const modalTime = document.getElementById('modal-time');
    const modalScreen = document.getElementById('modal-screen');
    const modalStatus = document.getElementById('modal-status');

    if (modalCinemaName) modalCinemaName.textContent = data.cinema;
    if (modalMovieTitle) modalMovieTitle.textContent = data.movie;
    if (modalTime) modalTime.textContent = data.time;
    if (modalScreen) modalScreen.textContent = `${data.screen} (${data.format})`;
    if (modalStatus) modalStatus.textContent = data.status;

    const reserveBtn = document.getElementById('modal-reserve-btn');
    if (reserveBtn) {
      reserveBtn.href = data.url || '#';
    }

    this.modalOverlay.classList.add('active');
  }

  closeModal() {
    if (this.modalOverlay) {
      this.modalOverlay.classList.remove('active');
    }
  }

  escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>"']/g, match => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[match]);
  }
}

export { UIRender as UiRender };
