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
      .replace(/[Ａ-Ｚａ-ｚ０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xfee0))
      .replace(/[\(（【\[].*?[\)）】\]]/g, '')
      .replace(/2D|3D|IMAX|4DX|Dolby Cinema|Dolby Atmos|ULTIRA|TCX|字幕|吹替|通常版/gi, '')
      .trim();

    return normalized || title.trim();
  }

  /**
   * インスタンスメソッド unify (app.js 互換用)
   * @param {Array<Object>} cinemaConfigs - 映画館設定配列
   * @param {Array<Object>} cinemaSchedules - 各映画館のフェッチ結果配列
   * @param {string} selectedDate - 選択日付文字列
   * @returns {Object} { cinemas, uniqueMovies, matrix }
   */
  unify(cinemaConfigs, cinemaSchedules, selectedDate) {
    return ScheduleUnifier.unifySchedules(cinemaSchedules, cinemaConfigs);
  }

  /**
   * 全映画館のデータを結合し、MAX方式でユニーク作品一覧とマトリクス構造を生成する (スタティックメソッド)
   * @param {Array<Object>} cinemaSchedules - 各映画館のフェッチ結果配列
   * @param {Array<Object>} cinemaConfigs - 映画館設定配列
   * @returns {Object} { uniqueMovies, matrix, cinemas }
   */
  static unifySchedules(cinemaSchedules = [], cinemaConfigs = []) {
    const movieMap = new Map();

    cinemaSchedules.forEach(cinemaData => {
      if (!cinemaData || !cinemaData.movies || !Array.isArray(cinemaData.movies)) return;

      const cinemaId = cinemaData.cinemaId;

      cinemaData.movies.forEach(movie => {
        if (!movie || !movie.title) return;

        const rawTitle = movie.title;
        const normTitle = ScheduleUnifier.normalizeTitle(rawTitle);

        if (!movieMap.has(normTitle)) {
          movieMap.set(normTitle, {
            normalizedTitle: normTitle,
            displayTitle: rawTitle.replace(/[\(（【\[](字幕|吹替|2D|3D)[\)）】\]]/g, '').trim(),
            cinemas: {}
          });
        }

        const movieEntry = movieMap.get(normTitle);
        movieEntry.cinemas[cinemaId] = movie.schedules || [];
      });
    });

    const uniqueMovies = Array.from(movieMap.values()).sort((a, b) => {
      return a.displayTitle.localeCompare(b.displayTitle, 'ja');
    });

    const enrichedCinemas = (cinemaConfigs || []).map(config => {
      const fetchedCinema = (cinemaSchedules || []).find(s => s && s.cinemaId === config.id);
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
