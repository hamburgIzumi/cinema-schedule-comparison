/**
 * @file uiRender.js
 * @description マトリクス比較表のレンダリング、検索フィルター、詳細モーダル表示を行うUI制御モジュール
 */

export class UiRender {
  constructor(tableContainerId, modalOverlayId, dateTabsContainerId = 'date-tabs-container') {
    this.tableContainer = document.getElementById(tableContainerId);
    this.modalOverlay = document.getElementById(modalOverlayId);
    this.dateTabsContainer = document.getElementById(dateTabsContainerId);
  }

  /**
   * 当日を含む7日間の日付ナビゲーションタブをレンダリングする
   * @param {Date} selectedDate - 現在選択中の日付
   * @param {Function} onDateSelectCallback - 日付切り替え時のコールバック関数
   */
  renderDateTabs(selectedDate, onDateSelectCallback) {
    if (!this.dateTabsContainer) return;

    const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let html = '';

    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);

      const isSelected = selectedDate.getDate() === d.getDate() && selectedDate.getMonth() === d.getMonth();
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
        <div class="date-tab-item ${dayClass} ${isSelected ? 'active' : ''}" data-date="${d.toISOString()}">
          <span class="date-tab-day">${dayLabel}</span>
          <span class="date-tab-date">${labelText} (${dayNames[dayOfWeek]})</span>
        </div>
      `;
    }

    this.dateTabsContainer.innerHTML = html;

    // タブクリックイベント
    const tabItems = this.dateTabsContainer.querySelectorAll('.date-tab-item');
    tabItems.forEach(item => {
      item.addEventListener('click', () => {
        const dateStr = item.dataset.date;
        const newDate = new Date(dateStr);
        if (onDateSelectCallback) {
          onDateSelectCallback(newDate);
        }
      });
    });
  }

  /**
   * 統合マトリクスデータから比較表HTMLを動的レンダリングする
   * @param {Object} unifiedData - { cinemas, matrix }
   * @param {string} filterText - 検索フィルター文字列
   */
  renderMatrixTable(unifiedData, filterText = '') {
    if (!this.tableContainer) return;

    const { cinemas, matrix } = unifiedData;
    const lowerFilter = filterText.toLowerCase().trim();

    // フィルターに合致する作品のみに絞り込み
    const filteredMatrix = matrix.filter(row => {
      if (!lowerFilter) return true;
      return row.title.toLowerCase().includes(lowerFilter);
    });

    if (filteredMatrix.length === 0) {
      this.tableContainer.innerHTML = `
        <div class="no-schedule" style="text-align: center; padding: 40px;">
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

    // 映画館列ヘッダー
    cinemas.forEach(cinema => {
      const demoBadgeHtml = cinema.isFallback 
        ? `<span class="demo-data-badge" title="通信制限等によりサンプルデータを表示中">⚠️ デモ（ダミー）データ</span>` 
        : ``;

      html += `
        <th>
          <div class="cinema-header-cell">
            <span class="cinema-name">${this.escapeHtml(cinema.name)}</span>
            <span class="cinema-brand-badge" style="border-left: 3px solid ${cinema.color || '#4facfe'}">
              <a href="${cinema.siteUrl}" target="_blank" rel="noopener noreferrer" style="color: inherit; text-decoration: none;">
                ${cinema.shortName || cinema.name} 🔗
              </a>
            </span>
            ${demoBadgeHtml}
          </div>
        </th>
      `;
    });

    html += `
          </tr>
        </thead>
        <tbody>
    `;

    // 作品行
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
              <div class="schedule-item-card" data-cinema="${this.escapeHtml(cinema.name)}" data-isfallback="${cinema.isFallback ? 'true' : 'false'}" data-movie="${this.escapeHtml(row.title)}" data-time="${this.escapeHtml(sched.time)}" data-screen="${this.escapeHtml(sched.screen)}" data-format="${this.escapeHtml(sched.format)}" data-status="${this.escapeHtml(sched.statusText)}" data-url="${this.escapeHtml(sched.reserveUrl)}">
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

  /**
   * 空席ステータス記号からバッジのCSSクラスを取得
   */
  getStatusBadgeClass(status) {
    switch (status) {
      case '◎': return 'status-plenty';
      case '◯': return 'status-available';
      case '△': return 'status-few';
      case '×': return 'status-full';
      default: return 'status-available';
    }
  }

  /**
   * スケジュールカードのクリックイベントリスナー設定
   */
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
          url: card.dataset.url,
          isFallback: card.dataset.isfallback === 'true'
        };
        this.openModal(data);
      });
    });
  }

  /**
   * 空席詳細モーダルを開く
   */
  openModal(data) {
    if (!this.modalOverlay) return;

    document.getElementById('modal-cinema-name').textContent = data.cinema;
    document.getElementById('modal-movie-title').textContent = data.movie;
    document.getElementById('modal-time').textContent = data.time;
    document.getElementById('modal-screen').textContent = `${data.screen} (${data.format})`;
    document.getElementById('modal-status').textContent = data.status;

    // デモデータ注記エリア
    let noticeEl = document.getElementById('modal-demo-notice');
    if (!noticeEl) {
      noticeEl = document.createElement('div');
      noticeEl.id = 'modal-demo-notice';
      noticeEl.className = 'demo-data-notice';
      const modalBody = this.modalOverlay.querySelector('.modal-body');
      if (modalBody) modalBody.appendChild(noticeEl);
    }

    if (data.isFallback) {
      noticeEl.style.display = 'block';
      noticeEl.innerHTML = `⚠️ <strong>【ご注意】</strong> このデータは通信制限等により表示されている接続テスト用サンプル（ダミー）です。最新の実際の状況は「予約サイトヘ進む」ボタンよりご確認ください。`;
    } else {
      noticeEl.style.display = 'none';
    }
    
    const reserveBtn = document.getElementById('modal-reserve-btn');
    if (reserveBtn) {
      reserveBtn.href = data.url || '#';
    }

    this.modalOverlay.classList.add('active');
  }

  /**
   * 空席詳細モーダルを閉じる
   */
  closeModal() {
    if (this.modalOverlay) {
      this.modalOverlay.classList.remove('active');
    }
  }

  /**
   * エスケープ処理
   */
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
