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
      
      // 8秒のタイムアウトシグナル
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(targetUrl, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        if (data && data.movies && data.movies.length > 0) {
          return data;
        }
      }
    } catch (e) {
      console.warn(`Cloudflare Workers API fetch failed or timed out for ${cinemaId}:`, e);
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
   * @param {string} targetUrl - 取得対象URL
   * @param {string} encoding - 文字エンコーディング（デフォルト 'utf-8'）
   */
  async fetchHtml(targetUrl, encoding = 'utf-8') {
    let lastError = null;

    for (const proxyGen of this.proxies) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      try {
        const proxyUrl = proxyGen(targetUrl);
        const response = await fetch(proxyUrl, {
          method: 'GET',
          headers: { 'Accept': 'text/html,application/xhtml+xml,application/xml' },
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          let htmlText;
          if (encoding.toLowerCase() === 'utf-8') {
            htmlText = await response.text();
          } else {
            // Shift_JISなどの別文字コードのデコード処理
            const buffer = await response.arrayBuffer();
            const decoder = new TextDecoder(encoding);
            htmlText = decoder.decode(buffer);
          }

          if (htmlText && htmlText.length > 100) {
            return htmlText;
          }
        }
      } catch (error) {
        clearTimeout(timeoutId);
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
