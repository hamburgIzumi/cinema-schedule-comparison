/**
 * @file configLoader.js
 * @description 映画館の設定ファイル (config/cinemas.json) を読み込み管理するモジュール
 */

export class ConfigLoader {
  /**
   * コンストラクタ
   * @param {string} configPath - 設定ファイルのパス（デフォルト: config/cinemas.json）
   */
  constructor(configPath = 'config/cinemas.json') {
    this.configPath = configPath;
    this.cinemas = [];
  }

  /**
   * 設定ファイルを非同期で読み込む
   * @returns {Promise<Array>} 有効な映画館設定のリスト
   */
  async loadConfig() {
    try {
      const response = await fetch(this.configPath);
      if (!response.ok) {
        throw new Error(`設定ファイルの読み込みに失敗しました: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      // 有効（enabled !== false）な映画館のみにフィルタリング
      this.cinemas = data.filter(cinema => cinema.enabled !== false);
      return this.cinemas;
    } catch (error) {
      console.error('ConfigLoader Error:', error);
      throw error;
    }
  }

  /**
   * 読み込まれたすべての映画館設定を取得
   * @returns {Array} 映画館設定配列
   */
  getCinemas() {
    return this.cinemas;
  }

  /**
   * 指定したIDの映画館設定を取得
   * @param {string} id - 映画館ID (例: 'toho-ebina')
   * @returns {Object|null} 映画館設定オブジェクト
   */
  getCinemaById(id) {
    return this.cinemas.find(c => c.id === id) || null;
  }
}
