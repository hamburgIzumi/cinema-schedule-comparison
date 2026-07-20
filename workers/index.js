/**
 * @file index.js (Cloudflare Workers)
 * @description 映画館の最新上映スケジュール・空席状況をリアルタイム動的フェッチしてJSONで返す専用APIプロキシ
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // CORSヘッダー定義
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Content-Type': 'application/json; charset=utf-8'
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const cinemaId = url.searchParams.get('cinema') || 'all';
    const dateStr = url.searchParams.get('date') || getTodayStr();

    try {
      let resultData;

      if (cinemaId.includes('toho')) {
        resultData = await fetchToho(cinemaId, dateStr);
      } else if (cinemaId.includes('aeon')) {
        resultData = await fetchAeon(cinemaId, dateStr);
      } else if (cinemaId.includes('109')) {
        resultData = await fetchTokyu109(cinemaId, dateStr);
      } else {
        resultData = {
          status: 'ok',
          message: 'Cinema Schedule Proxy API is Running!',
          supportedCinemas: ['toho-ebina', 'aeon-shinyurigaoka', '109-minamimachida', 'aeon-zama']
        };
      }

      return new Response(JSON.stringify(resultData, null, 2), {
        headers: corsHeaders
      });

    } catch (error) {
      return new Response(JSON.stringify({
        error: true,
        message: error.message,
        isFallback: true
      }), {
        status: 500,
        headers: corsHeaders
      });
    }
  }
};

/**
 * TOHOシネマズ海老名 リアルタイムフェッチ
 */
async function fetchToho(cinemaId, dateStr) {
  const targetUrl = `https://hlo.tohotheater.jp/net/schedule/007/TNPI2000J01.do?date=${dateStr}`;
  const response = await fetch(targetUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8'
    }
  });

  const html = await response.text();
  const movies = parseTohoHtml(html);

  return {
    cinemaId: cinemaId,
    cinemaName: "TOHOシネマズ 海老名",
    targetDate: dateStr,
    isFallback: movies.length === 0,
    fetchedAt: new Date().toISOString(),
    movies: movies.length > 0 ? movies : getFallbackMovies(dateStr)
  };
}

/**
 * イオンシネマ（新百合ヶ丘・座間） リアルタイムフェッチ
 */
async function fetchAeon(cinemaId, dateStr) {
  const code = cinemaId.includes('zama') ? 'zama' : 'shinyurigaoka';
  const cinemaName = cinemaId.includes('zama') ? "イオンシネマ 座間" : "イオンシネマ 新百合ヶ丘";
  const targetUrl = `https://theater.aeoncinema.com/theaters/${code}/?date=${dateStr}`;

  const response = await fetch(targetUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8'
    }
  });

  const html = await response.text();
  const movies = parseAeonHtml(html, `https://theater.aeoncinema.com/theaters/${code}/`);

  return {
    cinemaId: cinemaId,
    cinemaName: cinemaName,
    targetDate: dateStr,
    isFallback: movies.length === 0,
    fetchedAt: new Date().toISOString(),
    movies: movies.length > 0 ? movies : getFallbackMovies(dateStr)
  };
}

/**
 * 109シネマズ南町田 リアルタイムフェッチ
 */
async function fetchTokyu109(cinemaId, dateStr) {
  const targetUrl = `https://109cinemas.net/grandberrypark/?date=${dateStr}`;
  const response = await fetch(targetUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8'
    }
  });

  const html = await response.text();
  const movies = parse109Html(html);

  return {
    cinemaId: cinemaId,
    cinemaName: "109シネマズ 南町田グランベリーパーク",
    targetDate: dateStr,
    isFallback: movies.length === 0,
    fetchedAt: new Date().toISOString(),
    movies: movies.length > 0 ? movies : getFallbackMovies(dateStr)
  };
}

// パース補助関数群 (正規表現/簡易HTMLスプリッター)
function parseTohoHtml(html) {
  const movies = [];
  const movieBlocks = html.split(/class="[^"]*schedule-block[^"]*"/i);
  
  movieBlocks.forEach((block, idx) => {
    if (idx === 0) return;
    const titleMatch = block.match(/<h[234][^>]*>(.*?)<\/h[234]>/s) || block.match(/class="[^"]*movie-title[^"]*"[^>]*>(.*?)<\//s);
    if (!titleMatch) return;
    const title = cleanText(titleMatch[1]);

    const schedules = [];
    const timeMatches = block.matchAll(/<li[^>]*class="[^"]*time-table-item[^"]*"[^>]*>(.*?)<\/li>/gs);
    for (const tm of timeMatches) {
      const content = tm[1];
      const timeMatch = content.match(/(\d{2}:\d{2})/);
      if (timeMatch) {
        const time = timeMatch[1];
        const status = content.includes('◎') ? '◎' : (content.includes('△') ? '△' : (content.includes('×') ? '×' : '◯'));
        schedules.push({
          time: `${time} -`,
          startTime: time,
          screen: 'SCREEN 1',
          format: '2D',
          status: status,
          statusText: '予約可能',
          reserveUrl: 'https://hlo.tohotheater.jp/net/schedule/007/TNPI2000J01.do'
        });
      }
    }
    if (title && schedules.length > 0) {
      movies.push({ title, schedules });
    }
  });

  return movies;
}

function parseAeonHtml(html, baseUrl) {
  const movies = [];
  const movieBlocks = html.split(/class="[^"]*movie_box[^"]*"/i);

  movieBlocks.forEach((block, idx) => {
    if (idx === 0) return;
    const titleMatch = block.match(/class="[^"]*movie_title[^"]*"[^>]*>(.*?)<\//s) || block.match(/<h[234][^>]*>(.*?)<\/h[234]>/s);
    if (!titleMatch) return;
    const title = cleanText(titleMatch[1]);

    const schedules = [];
    const timeMatches = block.matchAll(/<div[^>]*class="[^"]*time_box[^"]*"[^>]*>(.*?)<\/div>/gs);
    for (const tm of timeMatches) {
      const content = tm[1];
      const timeMatch = content.match(/(\d{2}:\d{2})/);
      if (timeMatch) {
        const time = timeMatch[1];
        const status = content.includes('◎') ? '◎' : (content.includes('△') ? '△' : (content.includes('×') ? '×' : '◯'));
        schedules.push({
          time: `${time} -`,
          startTime: time,
          screen: 'スクリーン 1',
          format: '2D',
          status: status,
          statusText: '予約可能',
          reserveUrl: baseUrl
        });
      }
    }
    if (title && schedules.length > 0) {
      movies.push({ title, schedules });
    }
  });

  return movies;
}

function parse109Html(html) {
  const movies = [];
  const movieBlocks = html.split(/class="[^"]*schedule_movie[^"]*"/i);

  movieBlocks.forEach((block, idx) => {
    if (idx === 0) return;
    const titleMatch = block.match(/class="[^"]*title[^"]*"[^>]*>(.*?)<\//s) || block.match(/<h[234][^>]*>(.*?)<\/h[234]>/s);
    if (!titleMatch) return;
    const title = cleanText(titleMatch[1]);

    const schedules = [];
    const timeMatches = block.matchAll(/<div[^>]*class="[^"]*time_item[^"]*"[^>]*>(.*?)<\/div>/gs);
    for (const tm of timeMatches) {
      const content = tm[1];
      const timeMatch = content.match(/(\d{2}:\d{2})/);
      if (timeMatch) {
        const time = timeMatch[1];
        const status = content.includes('◎') ? '◎' : (content.includes('△') ? '△' : (content.includes('×') ? '×' : '◯'));
        schedules.push({
          time: `${time} -`,
          startTime: time,
          screen: 'シアター 1',
          format: '2D',
          status: status,
          statusText: '購入可能',
          reserveUrl: 'https://109cinemas.net/grandberrypark/'
        });
      }
    }
    if (title && schedules.length > 0) {
      movies.push({ title, schedules });
    }
  });

  return movies;
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

function getFallbackMovies(dateStr) {
  return [
    {
      title: "名探偵コナン 100万ドルの五稜星",
      schedules: [
        { time: "09:00 - 11:05", startTime: "09:00", screen: "SCREEN 1", format: "2D", status: "◎", statusText: "空席あり", reserveUrl: "#" },
        { time: "11:40 - 13:45", startTime: "11:40", screen: "SCREEN 1", format: "2D", status: "◯", statusText: "予約可能", reserveUrl: "#" },
        { time: "14:20 - 16:25", startTime: "14:20", screen: "SCREEN 1", format: "IMAX 2D", status: "△", statusText: "残りわずか", reserveUrl: "#" }
      ]
    }
  ];
}
