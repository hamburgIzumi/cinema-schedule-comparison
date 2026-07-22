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

    // 全角英数字を半角に変換
    let normalized = title
      .replace(/[Ａ-Ｚａ-ｚ０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xfee0));

    // かっこ書き (字幕、吹替など) の除去
    normalized = normalized.replace(/[\(（【\[].*?[\)）】\]]/g, '');

    // 上映フォーマットなどの不要なワード除去
    normalized = normalized.replace(/2D|3D|IMAX|4DX|Dolby Cinema|Dolby Atmos|ULTIRA|TCX|字幕|吹替|通常版/gi, '');

    // 日本語が含まれる場合に、末尾のローマ字・英語併記部分をトリム
    const hasJapanese = /[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/.test(normalized);
    if (hasJapanese) {
      // スペース（半角または全角）の後に、英数字・スペース・一部記号のみが末尾まで続くパターンを切り捨てる
      const match = normalized.match(/^(.*?)(?:[\s　]+[A-Za-z0-9\s\.,!\?\-_/&:]+)$/);
      if (match) {
        normalized = match[1];
      }
    }

    // 全角スペースと半角スペースを統一してトリム
    normalized = normalized.replace(/[\s　]+/g, ' ').trim();

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
          // 表示用タイトルのクリーンアップ
          let displayTitle = rawTitle.replace(/[\(（【\[](字幕|吹替|2D|3D|IMAX|MX4D)[\)）】\]]/gi, '').trim();
          displayTitle = displayTitle.replace(/[\s　]+/g, ' ').trim();

          // tohoの英語併記除去を displayTitle にも適用
          const hasJapanese = /[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/.test(displayTitle);
          if (hasJapanese) {
            const match = displayTitle.match(/^(.*?)(?:[\s　]+[A-Za-z0-9\s\.,!\?\-_/&:]+)$/);
            if (match) {
              displayTitle = match[1].trim();
            }
          }

          movieMap.set(normTitle, {
            normalizedTitle: normTitle,
            displayTitle: displayTitle,
            cinemas: {}
          });
        }

        const movieEntry = movieMap.get(normTitle);
        // 同一作品の別バージョン（通常/MX4D等）で上書きされないよう、既存配列があれば結合する
        movieEntry.cinemas[cinemaId] = (movieEntry.cinemas[cinemaId] || []).concat(movie.schedules || []);
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
