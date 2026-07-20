/**
 * @file corsProxy.js
 * @description CORSプロキシを経由して動的に外部HTML/JSONデータを取得する通信モジュール
 */

export class CorsProxyService {
  constructor() {
    // 利用可能なCORSプロキシプロバイダ一覧（フォールバック用）
    this.proxies = [
      url => `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
      url => `https://corsproxy.io/?${encodeURIComponent(url)}`,
      url => `https://proxy.cors.sh/${url}`
    ];
  }

  /**
   * 指定したURLのHTMLテキストをCORSプロキシ経由で動的取得する
   * @param {string} targetUrl - 取得対象のURL
   * @returns {Promise<string>} HTMLコンテンツ文字列
   */
  async fetchHtml(targetUrl) {
    let lastError = null;

    for (const proxyGenerator of this.proxies) {
      try {
        const proxyUrl = proxyGenerator(targetUrl);
        const response = await fetch(proxyUrl, {
          headers: {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
          }
        });

        if (!response.ok) {
          continue;
        }

        if (proxyUrl.includes('allorigins.win')) {
          const json = await response.json();
          if (json && json.contents) {
            return json.contents;
          }
        } else {
          const text = await response.text();
          if (text && text.trim().length > 0) {
            return text;
          }
        }
      } catch (error) {
        lastError = error;
        console.warn(`CORS Proxy failed for ${targetUrl} via proxy:`, error);
      }
    }

    throw new Error(`すべてのCORSプロキシ経由の通信に失敗しました: ${targetUrl} (${lastError ? lastError.message : ''})`);
  }

  /**
   * 指定したURLのJSONデータをCORSプロキシ経由で動的取得する
   * @param {string} targetUrl - 取得対象のAPI URL
   * @returns {Promise<Object>} パース済みJSONオブジェクト
   */
  async fetchJson(targetUrl) {
    let lastError = null;

    for (const proxyGenerator of this.proxies) {
      try {
        const proxyUrl = proxyGenerator(targetUrl);
        const response = await fetch(proxyUrl, {
          headers: {
            'Accept': 'application/json, text/plain, */*'
          }
        });

        if (!response.ok) {
          continue;
        }

        if (proxyUrl.includes('allorigins.win')) {
          const resJson = await response.json();
          if (resJson && resJson.contents) {
            try {
              return typeof resJson.contents === 'string' ? JSON.parse(resJson.contents) : resJson.contents;
            } catch (e) {
              return resJson.contents;
            }
          }
        } else {
          const data = await response.json();
          if (data) {
            return data;
          }
        }
      } catch (error) {
        lastError = error;
        console.warn(`CORS Proxy JSON failed for ${targetUrl}:`, error);
      }
    }

    throw new Error(`すべてのCORSプロキシ経由のJSON通信に失敗しました: ${targetUrl} (${lastError ? lastError.message : ''})`);
  }

  /**
   * HTML文字列をDOMDocumentオブジェクトにパースする
   * @param {string} htmlString - HTML文字列
   * @returns {Document} HTML DOM Document
   */
  parseDom(htmlString) {
    const parser = new DOMParser();
    return parser.parseFromString(htmlString, 'text/html');
  }
}
