/**
 * @file uiRender.js
 * @description マトリクス比較表のレンダリング、検索フィルター、詳細モーダル表示を行うUI制御モジュール
 */

export class UiRender {
  constructor(tableContainerId, modalOverlayId) {
    this.tableContainer = document.getElementById(tableContainerId);
    this.modalOverlay = document.getElementById(modalOverlayId);
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
          url: card.dataset.url
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
