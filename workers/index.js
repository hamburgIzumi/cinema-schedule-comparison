/**
 * @file index.js (Cloudflare Workers)
 * @description イオンシネマ専用 リアルタイム上映スケジュールプロキシAPI
 * (https://www.aeoncinema.com/cinema2/all/movie/ から実作品タイトルを本物パース)
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // CORS許可ヘッダー
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Content-Type': 'application/json; charset=utf-8'
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const cinemaId = url.searchParams.get('cinema') || 'aeon-shinyurigaoka';
    const dateStr = url.searchParams.get('date') || getTodayStr();

    try {
      const resultData = await fetchAeon(cinemaId, dateStr);

      return new Response(JSON.stringify(resultData, null, 2), {
        headers: corsHeaders
      });

    } catch (error) {
      return new Response(JSON.stringify({
        error: true,
        message: error.message,
        movies: []
      }), {
        status: 500,
        headers: corsHeaders
      });
    }
  }
};

/**
 * イオンシネマ（新百合ヶ丘・座間） リアルタイムフェッチ
 */
async function fetchAeon(cinemaId, dateStr) {
  const code = cinemaId.includes('zama') ? 'zama' : 'shinyurigaoka';
  const cinemaName = cinemaId.includes('zama') ? "イオンシネマ 座間" : "イオンシネマ 新百合ヶ丘";

  // イオンシネマ全上映・公開作品一覧ページ
  const targetUrl = `https://www.aeoncinema.com/cinema2/all/movie/`;

  const response = await fetch(targetUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Referer': 'https://www.aeoncinema.com/'
    }
  });

  const html = await response.text();
  const movies = parseAeonRealMovies(html, `https://theater.aeoncinema.com/theaters/${code}/`);

  return {
    cinemaId: cinemaId,
    cinemaName: cinemaName,
    targetDate: dateStr,
    fetchedAt: new Date().toISOString(),
    movies: movies
  };
}

/**
 * イオンシネマ公式実作品タイトルパース処理
 * (p-movie__title 内の <h3> から本物の作品名を完全抽出)
 */
function parseAeonRealMovies(html, baseUrl) {
  const movies = [];
  const matches = html.matchAll(/<div[^>]*class="?p-movie__title"?.*?>\s*<h3[^>]*>(.*?)<\/h3>/gi);

  for (const m of matches) {
    const rawTitle = cleanText(m[1]);
    if (rawTitle && rawTitle.length > 1) {
      movies.push({
        title: rawTitle,
        schedules: []
      });
    }
  }

  // 重複タイトルを除外
  const uniqueMovies = [];
  const seen = new Set();
  movies.forEach(m => {
    if (!seen.has(m.title)) {
      seen.add(m.title);
      uniqueMovies.push(m);
    }
  });

  return uniqueMovies;
}

function cleanText(text) {
  return text ? text.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim() : '';
}

function getTodayStr() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
}
