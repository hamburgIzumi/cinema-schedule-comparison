/**
 * @file index.js (Cloudflare Workers)
 * @description 映画館の最新上映スケジュール・空席状況をリアルタイムパースして返却する高度APIプロキシ
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

    const cinemaId = url.searchParams.get('cinema') || 'all';
    const dateStr = url.searchParams.get('date') || getTodayStr();
    const isDebug = url.searchParams.get('debug') === 'true';

    try {
      let resultData;

      if (cinemaId.includes('toho')) {
        resultData = await fetchToho(cinemaId, dateStr, isDebug);
      } else if (cinemaId.includes('aeon')) {
        resultData = await fetchAeon(cinemaId, dateStr, isDebug);
      } else if (cinemaId.includes('109')) {
        resultData = await fetchTokyu109(cinemaId, dateStr, isDebug);
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
async function fetchToho(cinemaId, dateStr, isDebug) {
  const targetUrl = `https://hlo.tohotheater.jp/net/schedule/007/TNPI2000J01.do?date=${dateStr}`;
  const response = await fetch(targetUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
      'Referer': 'https://www.tohotheater.jp/'
    }
  });

  const html = await response.text();
  const movies = parseTohoHtml(html);

  return {
    cinemaId: cinemaId,
    cinemaName: "TOHOシネマズ 海老名",
    targetDate: dateStr,
    isFallback: movies.length === 0,
    debugHtmlLength: isDebug ? html.length : undefined,
    fetchedAt: new Date().toISOString(),
    movies: movies.length > 0 ? movies : getFallbackMovies(dateStr)
  };
}

/**
 * イオンシネマ（新百合ヶ丘・座間） リアルタイムフェッチ
 */
async function fetchAeon(cinemaId, dateStr, isDebug) {
  const code = cinemaId.includes('zama') ? 'zama' : 'shinyurigaoka';
  const cinemaName = cinemaId.includes('zama') ? "イオンシネマ 座間" : "イオンシネマ 新百合ヶ丘";
  const targetUrl = `https://theater.aeoncinema.com/theaters/${code}/?date=${dateStr}`;

  const response = await fetch(targetUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
      'Referer': `https://theater.aeoncinema.com/theaters/${code}/`
    }
  });

  const html = await response.text();
  const movies = parseAeonHtml(html, `https://theater.aeoncinema.com/theaters/${code}/`);

  return {
    cinemaId: cinemaId,
    cinemaName: cinemaName,
    targetDate: dateStr,
    isFallback: movies.length === 0,
    debugHtmlLength: isDebug ? html.length : undefined,
    fetchedAt: new Date().toISOString(),
    movies: movies.length > 0 ? movies : getFallbackMovies(dateStr)
  };
}

/**
 * 109シネマズ南町田 リアルタイムフェッチ
 */
async function fetchTokyu109(cinemaId, dateStr, isDebug) {
  const targetUrl = `https://109cinemas.net/grandberrypark/?date=${dateStr}`;
  const response = await fetch(targetUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
      'Referer': 'https://109cinemas.net/'
    }
  });

  const html = await response.text();
  const movies = parse109Html(html);

  return {
    cinemaId: cinemaId,
    cinemaName: "109シネマズ 南町田グランベリーパーク",
    targetDate: dateStr,
    isFallback: movies.length === 0,
    debugHtmlLength: isDebug ? html.length : undefined,
    fetchedAt: new Date().toISOString(),
    movies: movies.length > 0 ? movies : getFallbackMovies(dateStr)
  };
}

/**
 * TOHOシネマズ用 精密HTMLパース
 */
function parseTohoHtml(html) {
  const movies = [];
  
  // HTMLブロック分割の柔軟パターン化
  const blocks = html.split(/<(?:div|section|article)[^>]*class="[^"]*(?:schedule-block|schedule-movie|movie-block|section-schedule|movie-item)[^"]*"[^>]*>/i);

  blocks.forEach((block, idx) => {
    if (idx === 0) return;
    
    // タイトル検出の多重正規表現
    const titleMatch = block.match(/<(?:h[2-4]|p|span|div|a)[^>]*class="[^"]*(?:movie-title|title|heading|name)[^"]*"[^>]*>(.*?)<\/(?:h[2-4]|p|span|div|a)>/is)
                    || block.match(/<h[2-4][^>]*>(.*?)<\/h[2-4]>/is)
                    || block.match(/alt="([^"]+)"/i);

    if (!titleMatch) return;
    const title = cleanText(titleMatch[1]);
    if (!title || title.length < 2 || title.includes('ニュース') || title.includes('アクセス')) return;

    const schedules = extractSchedulesFromBlock(block, 'https://hlo.tohotheater.jp/net/schedule/007/TNPI2000J01.do');
    if (schedules.length > 0) {
      movies.push({ title, schedules });
    }
  });

  return movies;
}

/**
 * イオンシネマ用 精密HTMLパース
 */
function parseAeonHtml(html, baseUrl) {
  const movies = [];
  const blocks = html.split(/<(?:div|section|article|li)[^>]*class="[^"]*(?:movie_box|schedule_box|movie-box|movie-item|schedule-movie)[^"]*"[^>]*>/i);

  blocks.forEach((block, idx) => {
    if (idx === 0) return;

    const titleMatch = block.match(/<(?:h[2-4]|p|span|div|a)[^>]*class="[^"]*(?:movie_title|title|movie-name|name)[^"]*"[^>]*>(.*?)<\/(?:h[2-4]|p|span|div|a)>/is)
                    || block.match(/<h[2-4][^>]*>(.*?)<\/h[2-4]>/is)
                    || block.match(/alt="([^"]+)"/i);

    if (!titleMatch) return;
    const title = cleanText(titleMatch[1]);
    if (!title || title.length < 2 || title.includes('劇場トップ') || title.includes('料金')) return;

    const schedules = extractSchedulesFromBlock(block, baseUrl);
    if (schedules.length > 0) {
      movies.push({ title, schedules });
    }
  });

  return movies;
}

/**
 * 109シネマズ用 精密HTMLパース
 */
function parse109Html(html) {
  const movies = [];
  const blocks = html.split(/<(?:div|section|article)[^>]*class="[^"]*(?:schedule_movie|movie-schedule|schedule-item|movie-box)[^"]*"[^>]*>/i);

  blocks.forEach((block, idx) => {
    if (idx === 0) return;

    const titleMatch = block.match(/<(?:h[2-4]|p|span|div|a)[^>]*class="[^"]*(?:title|movie_name|name)[^"]*"[^>]*>(.*?)<\/(?:h[2-4]|p|span|div|a)>/is)
                    || block.match(/<h[2-4][^>]*>(.*?)<\/h[2-4]>/is)
                    || block.match(/alt="([^"]+)"/i);

    if (!titleMatch) return;
    const title = cleanText(titleMatch[1]);
    if (!title || title.length < 2 || title.includes('施設案内')) return;

    const schedules = extractSchedulesFromBlock(block, 'https://109cinemas.net/grandberrypark/');
    if (schedules.length > 0) {
      movies.push({ title, schedules });
    }
  });

  return movies;
}

/**
 * 各ブロック内から上映時刻・空席情報を柔軟抽出する汎用パーサー
 */
function extractSchedulesFromBlock(block, reserveUrl) {
  const schedules = [];
  
  // 時刻パターン (例: 09:15 - 11:20 または 09:15〜 や 09:15) のマッチング
  const timeMatches = block.matchAll(/(\d{1,2}:\d{2})\s*(?:[〜~\-ー\s]*(\d{1,2}:\d{2}))?/g);

  for (const match of timeMatches) {
    const startTime = match[1];
    const endTime = match[2] || '';
    const fullTimeStr = endTime ? `${startTime} - ${endTime}` : `${startTime} -`;

    // 空席状況の判定
    let status = '◯';
    let statusText = '予約可能';
    const subSnippet = block.substring(match.index, match.index + 200);

    if (subSnippet.includes('◎') || subSnippet.includes('余裕') || subSnippet.includes('空席あり')) {
      status = '◎';
      statusText = '余裕あり';
    } else if (subSnippet.includes('△') || subSnippet.includes('わずか') || subSnippet.includes('残りわずか')) {
      status = '△';
      statusText = '残りわずか';
    } else if (subSnippet.includes('×') || subSnippet.includes('満席') || subSnippet.includes('完売')) {
      status = '×';
      statusText = '満席';
    }

    // スクリーン名の抽出試行
    const screenMatch = subSnippet.match(/(スクリーン\s*\d+|SCREEN\s*\d+|シアター\s*\d+|IMAX|4DX|ULTIRA)/i);
    const screen = screenMatch ? screenMatch[1] : 'スクリーン 1';

    schedules.push({
      time: fullTimeStr,
      startTime: startTime,
      endTime: endTime,
      screen: screen,
      format: subSnippet.includes('3D') ? '3D' : (subSnippet.includes('字幕') ? '2D / 字幕' : '2D / 吹替'),
      status: status,
      statusText: statusText,
      reserveUrl: reserveUrl
    });

    // 最大8枠までに重複防止で制限
    if (schedules.length >= 8) break;
  }

  return schedules;
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
