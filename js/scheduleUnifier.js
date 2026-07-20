/**
 * @file scheduleUnifier.js
 * @description 各映画館から取得した上映作品データを「MAX方式」でユニーク化し、マトリクス構造を構築するモジュール
 */

export class ScheduleUnifier {
  /**
   * 作品タイトルの名寄せ用正規化処理
   * @param {string} title - 原本タイトル
   * @returns {string} 正規化済み基準タイトル
   */
  static normalizeTitle(title) {
    if (!title) return '';

    let normalized = title
      // 全角英数字を半角に変換
      .replace(/[Ａ-Ｚａ-ｚ０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xfee0))
      // 記号や特定の付加文字列（【字幕】, [吹替], IMAX, 3D 等）を除去して共通名を作成
      .replace(/[\(（【\[].*?[\)）】\]]/g, '')
      .replace(/2D|3D|IMAX|4DX|Dolby Cinema|Dolby Atmos|ULTIRA|TCX|字幕|吹替|通常版/gi, '')
      .trim();

    return normalized || title.trim();
  }

  /**
   * 全映画館のデータを結合し、MAX方式でユニーク作品一覧とマトリクス構造を生成する
   * @param {Array<Object>} cinemaSchedules - 各映画館のフェッチ結果配列
   * @param {Array<Object>} cinemaConfigs - 映画館設定配列
   * @returns {Object} { uniqueMovies, matrixData, cinemas }
   */
  static unifySchedules(cinemaSchedules, cinemaConfigs) {
    const movieMap = new Map(); // key: normalizedTitle, value: { displayTitle, cinemaMap }

    // 1. 各映画館の作品情報を巡回し、ユニークな作品マスターを構築
    cinemaSchedules.forEach(cinemaData => {
      const cinemaId = cinemaData.cinemaId;

      if (!cinemaData.movies || !Array.isArray(cinemaData.movies)) return;

      cinemaData.movies.forEach(movie => {
        const rawTitle = movie.title;
        const normTitle = this.normalizeTitle(rawTitle);

        if (!movieMap.has(normTitle)) {
          movieMap.set(normTitle, {
            normalizedTitle: normTitle,
            displayTitle: rawTitle.replace(/[\(（【\[](字幕|吹替|2D|3D)[\)）】\]]/g, '').trim(),
            cinemas: {}
          });
        }

        const movieEntry = movieMap.get(normTitle);
        // 各映画館でのスケジュールを格納
        movieEntry.cinemas[cinemaId] = movie.schedules || [];
      });
    });

    // 2. ユニーク作品リストの配列化（作品名順または上映枠数が多い順にソート）
    const uniqueMovies = Array.from(movieMap.values()).sort((a, b) => {
      return a.displayTitle.localeCompare(b.displayTitle, 'ja');
    });

    // 3. マトリクス表示用データの構築および映画館メタ情報（isFallback）の保持
    const enrichedCinemas = cinemaConfigs.map(config => {
      const fetchedCinema = cinemaSchedules.find(s => s.cinemaId === config.id);
      return {
        ...config,
        isFallback: fetchedCinema ? !!fetchedCinema.isFallback : false,
        fallbackReason: fetchedCinema ? fetchedCinema.fallbackReason : ''
      };
    });

    const matrix = uniqueMovies.map(movie => {
      const row = {
        title: movie.displayTitle,
        normalizedTitle: movie.normalizedTitle,
        cinemaSchedules: {}
      };

      enrichedCinemas.forEach(config => {
        row.cinemaSchedules[config.id] = movie.cinemas[config.id] || [];
      });

      return row;
    });

    return {
      cinemas: enrichedCinemas,
      uniqueMovies: uniqueMovies,
      matrix: matrix
    };
  }
}
