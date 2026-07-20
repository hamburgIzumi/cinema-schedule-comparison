/**
 * @file corsProxy.js
 * @description Cloudflare Workers リアルタイムプロキシAPIおよび各種パブリックCORSプロキシ通信の統合管理モジュール
 */

export class CorsProxyService {
  constructor() {
    // デフォルトのパブリックCORSプロキシリスト
    this.proxies = [
      (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
      (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
      (url) => `https://thingproxy.freeboard.io/fetch/${url}`
    ];
  }

  /**
   * Cloudflare Workers 専用プロキシAPIからリアルタイム実データJSONを取得する
   * @param {string} workersApiUrl - Workers APIのベースURL (例: https://cinema-schedule-proxy.workers.dev)
   * @param {string} cinemaId - 映画館ID (例: aeon-zama, toho-ebina)
   * @param {string} dateStr - 対象日 (例: 20260721)
   * @returns {Promise<Object|null>} 抽出されたスケジュール構造化JSON
   */
  async fetchFromWorkersApi(workersApiUrl, cinemaId, dateStr) {
    if (!workersApiUrl) return null;

    try {
      const targetUrl = `${workersApiUrl.replace(/\/$/, '')}/?cinema=${encodeURIComponent(cinemaId)}&date=${encodeURIComponent(dateStr)}`;
      const response = await fetch(targetUrl, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });

      if (response.ok) {
        const data = await response.json();
        if (data && data.movies && data.movies.length > 0) {
          return data;
        }
      }
    } catch (e) {
      console.warn(`Cloudflare Workers API fetch failed for ${cinemaId}:`, e);
    }
    return null;
  }

  /**
   * パブリックプロキシ経由でJSONを取得する
   */
  async fetchJson(targetUrl) {
    for (const proxyGen of this.proxies) {
      try {
        const proxyUrl = proxyGen(targetUrl);
        const res = await fetch(proxyUrl, { method: 'GET' });
        if (res.ok) {
          return await res.json();
        }
      } catch (e) {
        console.warn(`CORS Proxy fetchJson error for ${targetUrl}:`, e);
      }
    }
    return null;
  }

  /**
   * パブリックプロキシ経由でHTML文字列を取得する
   */
  async fetchHtml(targetUrl) {
    let lastError = null;

    for (const proxyGen of this.proxies) {
      try {
        const proxyUrl = proxyGen(targetUrl);
        const response = await fetch(proxyUrl, {
          method: 'GET',
          headers: { 'Accept': 'text/html,application/xhtml+xml,application/xml' }
        });

        if (response.ok) {
          const htmlText = await response.text();
          if (htmlText && htmlText.length > 100) {
            return htmlText;
          }
        }
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError || new Error(`All CORS proxies failed to fetch URL: ${targetUrl}`);
  }

  /**
   * HTML文字列をDOM Documentオブジェクトにパースする
   */
  parseDom(htmlString) {
    const parser = new DOMParser();
    return parser.parseFromString(htmlString, 'text/html');
  }
}
