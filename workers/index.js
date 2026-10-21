/**
 * @file index.js (Cloudflare Workers)
 * @description 映画館スケジュールAPIプロキシ
 * - イオンシネマ: 公式JSON API経由でリアルタイムデータ取得
 * - TOHOシネマズ: 印刷用スケジュールページ (TNPI2160J01.do) をHTMLスクレイピング
 * - 109シネマズ: 日付別スケジュールページ (YYYYMMDD.html) をHTMLスクレイピング
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
      let resultData;

      // cinemaIdの先頭ブランド名でルーティング
      if (cinemaId.startsWith('toho')) {
        resultData = await fetchTohoSchedule(cinemaId, dateStr);
      } else if (cinemaId.startsWith('109')) {
        resultData = await fetch109Schedule(cinemaId, dateStr);
      } else {
        // デフォルト: イオンシネマ
        resultData = await fetchAeonOfficialSchedule(cinemaId, dateStr);
      }

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

// ============================================================
// TOHOシネマズ
// ============================================================

/**
 * TOHOシネマズ印刷用スケジュールページをスクレイピング
 * Shift-JISでエンコードされたHTMLをTextDecoderでデコードして処理
 */
async function fetchTohoSchedule(cinemaId, dateStr) {
  const siteCode = cinemaId.includes('ebina') ? '007' : '007';
  const cinemaName = 'TOHOシネマズ 海老名';

  const targetUrl = `https://hlo.tohotheater.jp/net/schedule/${siteCode}/TNPI2160J01.do?site_cd=${siteCode}&show_day=${dateStr}&_dc=${Date.now()}`;

  const response = await fetch(targetUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
      'Accept-Charset': 'Shift_JIS,utf-8;q=0.7,*;q=0.3'
    }
  });

  if (!response.ok) {
    throw new Error(`TOHO取得失敗 (Status: ${response.status})`);
  }

  // Shift-JISデコード
  const buffer = await response.arrayBuffer();
  const html = new TextDecoder('shift-jis').decode(buffer);

  const movies = parseTohoHtml(html, siteCode);
  const reserveBaseUrl = `https://hlo.tohotheater.jp/net/schedule/${siteCode}/TNPI2000J01.do`;

  return {
    cinemaId: cinemaId,
    cinemaName: cinemaName,
    targetDate: dateStr,
    fetchedAt: new Date().toISOString(),
    movies: movies.map(m => ({
      ...m,
      schedules: m.schedules.map(s => ({ ...s, reserveUrl: reserveBaseUrl }))
    }))
  };
}

/**
 * TOHOシネマズのHTMLをRegexでパース
 * 構造: .movie-box > h4 (タイトル), table.screen-list > tr > .screen-name + .time-cell
 */
function parseTohoHtml(html, siteCode) {
  const movies = [];

  // 各 .movie-box ブロックを抽出
  const movieBoxPattern = /<div[^>]+class="[^"]*movie-box[^"]*"[^>]*>([\s\S]*?)(?=<div[^>]+class="[^"]*movie-box[^"]*"|<\/div>\s*<\/div>\s*<\/div>\s*$)/gi;

  // movie-boxが見つからない場合は全体を対象にする
  let movieBlocks = [];
  let match;

  // h4タグでタイトル一覧を取得してブロックに分割
  const h4Pattern = /<h4[^>]*>([\s\S]*?)<\/h4>/gi;
  const h4Positions = [];
  while ((match = h4Pattern.exec(html)) !== null) {
    const rawTitle = stripHtml(match[1]).trim();
    if (!rawTitle || rawTitle.includes('上映案内') || rawTitle.includes('ご案内') || rawTitle.length < 2) continue;
    h4Positions.push({ title: rawTitle, index: match.index, endIndex: match.index + match[0].length });
  }

  // 各タイトルブロックを処理
  for (let i = 0; i < h4Positions.length; i++) {
    const { title: rawTitle, endIndex: blockStart } = h4Positions[i];
    const blockEnd = i + 1 < h4Positions.length ? h4Positions[i + 1].index : html.length;
    const block = html.substring(blockStart, blockEnd);

    // タイトルから上映フォーマット情報を抽出後、タイトルを正規化
    const upperTitle = rawTitle.toUpperCase();
    let formatParts = [];
    if (upperTitle.includes('MX4D')) formatParts.push('MX4D');
    else if (upperTitle.includes('IMAX')) formatParts.push('IMAX');
    else if (upperTitle.includes('3D')) formatParts.push('3D');

    if (upperTitle.includes('SUB') || rawTitle.includes('字幕')) formatParts.push('字幕');
    else if (upperTitle.includes('DUB') || rawTitle.includes('吹替')) formatParts.push('吹替');

    const format = formatParts.join(' ') || '2D';

    // 末尾の / MX4D, / SUB などを除去したタイトル
    let title = rawTitle
      .replace(/\s*\/\s*(MX4D|IMAX|3D|SUB|DUB|吹替|字幕)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!title) continue;

    // screen-list テーブルから上映枠を抽出
    const schedules = [];
    const screenListPattern = /<table[^>]+class="[^"]*screen-list[^"]*"[^>]*>([\s\S]*?)<\/table>/gi;
    let tableMatch;

    while ((tableMatch = screenListPattern.exec(block)) !== null) {
      const tableContent = tableMatch[1];

      // 各 tr をパース
      const trPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
      let trMatch;

      while ((trMatch = trPattern.exec(tableContent)) !== null) {
        const rowContent = trMatch[1];

        // スクリーン名
        const screenNameMatch = /<[^>]+class="[^"]*screen-name[^"]*"[^>]*>([\s\S]*?)<\/(?:td|th|div|span)>/i.exec(rowContent);
        if (!screenNameMatch) continue;
        const screenName = stripHtml(screenNameMatch[1]).trim().replace(/\s+/g, ' ');

        // time-cell から上映時間を抽出
        const timeCellPattern = /<[^>]+class="[^"]*time-cell[^"]*"[^>]*>([\s\S]*?)<\/(?:td|th|div|span)>/gi;
        let timeCellMatch;

        while ((timeCellMatch = timeCellPattern.exec(rowContent)) !== null) {
          const cellText = stripHtml(timeCellMatch[1]).replace(/\s+/g, '').trim();
          const timeMatch = /(\d{1,2}:\d{2})-(\d{1,2}:\d{2})/.exec(cellText);
          if (!timeMatch) continue;

          schedules.push({
            time: timeMatch[0],
            startTime: timeMatch[1],
            endTime: timeMatch[2],
            screen: screenName,
            format: format,
            status: '-',
            statusText: '空席情報なし',
            reserveUrl: ''
          });
        }
      }
    }

    if (schedules.length > 0) {
      // 同タイトルが既に存在する場合はスケジュールをマージ
      const existing = movies.find(m => m.title === title);
      if (existing) {
        existing.schedules.push(...schedules);
      } else {
        movies.push({ title, schedules });
      }
    }
  }

  // 時間順にソート
  movies.forEach(m => {
    m.schedules.sort((a, b) => a.startTime.localeCompare(b.startTime));
  });

  return movies;
}

// ============================================================
// 109シネマズ
// ============================================================

/**
 * 109シネマズの日付別スケジュールページをスクレイピング
 */
async function fetch109Schedule(cinemaId, dateStr) {
  const cinemaName = '109シネマズ グランベリーパーク';
  const baseUrl = 'https://109cinemas.net/grandberrypark/';

  // 複数のURL候補を順に試行（日付別スケジュールページ、または日付クエリ付きトップページ）
  const targetUrls = [
    `${baseUrl}schedules/${dateStr}.html?theater_code=G1`,
    `${baseUrl}schedules/${dateStr}.html`,
    `${baseUrl}?date=${dateStr}`,
    `${baseUrl}`
  ];

  const browserHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
    'Cache-Control': 'max-age=0',
    'Sec-Ch-Ua': '"Not/A)Brand";v="8", "Chromium";v="126", "Google Chrome";v="126"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Windows"',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'same-origin',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1',
    'Referer': 'https://109cinemas.net/'
  };

  let html = '';
  let lastError = null;

  for (const targetUrl of targetUrls) {
    try {
      const response = await fetch(targetUrl, {
        headers: browserHeaders
      });

      if (response.ok) {
        const text = await response.text();
        if (text && (text.includes('timetable') || text.includes('article') || text.includes('ストリートファイター'))) {
          html = text;
          break;
        }
      } else {
        lastError = new Error(`109シネマズ取得失敗 (Status: ${response.status}) at ${targetUrl}`);
      }
    } catch (err) {
      lastError = err;
    }
  }

  if (!html) {
    throw lastError || new Error(`109シネマズのHTML取得に失敗しました`);
  }

  const movies = parse109Html(html);

  return {
    cinemaId: cinemaId,
    cinemaName: cinemaName,
    targetDate: dateStr,
    fetchedAt: new Date().toISOString(),
    movies: movies
  };
}

/**
 * 109シネマズのHTMLをRegexでパース
 * 構造: 
 *   - レガシー構造: article > header h2 (タイトル), ul.timetable > li.theatre (.theatre-num) + li.check_date (.start + .end)
 *   - 新構造: article > h2 (タイトル), 各シアター別ブロック (div等) 内のシアター表記、<time>開始時刻</time> ~ <time>終了時刻</time>、購入リンク/販売終了
 */
function parse109Html(html) {
  const movies = [];
  const siteBase = 'https://109cinemas.net';

  // article ブロック（各映画作品）を抽出
  const articlePattern = /<article[^>]*>([\s\S]*?)<\/article>/gi;
  let articleMatch;

  while ((articleMatch = articlePattern.exec(html)) !== null) {
    const fullArticleHtml = articleMatch[0];

    // タイトルを h2 から取得
    const h2Match = /<h2[^>]*>([\s\S]*?)<\/h2>/i.exec(fullArticleHtml);
    if (!h2Match) continue;
    const title = stripHtml(h2Match[1]).trim();
    if (!title) continue;

    const schedules = [];

    // パターン1: レガシー構造 (ul.timetable が存在する場合)
    const ulPattern = /<ul[^>]+class="[^"]*timetable[^"]*"[^>]*>([\s\S]*?)<\/ul>/gi;
    let ulMatch;
    let hasUlTimetable = false;

    while ((ulMatch = ulPattern.exec(fullArticleHtml)) !== null) {
      hasUlTimetable = true;
      const ulContent = ulMatch[1];

      // スクリーン情報 (li.theatre)
      const theatreMatch = /<li[^>]+class="[^"]*theatre[^"]*"[^>]*>([\s\S]*?)<\/li>/i.exec(ulContent);
      let screenName = 'スクリーン';
      let screenFormat = '2D';

      if (theatreMatch) {
        const theatreContent = theatreMatch[1];
        const numMatch = /<[^>]+class="[^"]*theatre-num[^"]*"[^>]*>([\s\S]*?)<\/[^>]+>/i.exec(theatreContent);
        const theatreNum = numMatch ? stripHtml(numMatch[1]).trim() : '';
        screenName = theatreNum ? `シアター${theatreNum}` : 'スクリーン';

        const theatreText = stripHtml(theatreContent).toUpperCase();
        if (theatreText.includes('IMAX')) screenFormat = 'IMAX';
        else if (theatreText.includes('4DX')) screenFormat = '4DX';
        else if (theatreText.includes('SAION')) screenFormat = 'SAION';
        else if (theatreText.includes('3D')) screenFormat = '3D';
      }

      // 音声・翻訳フォーマット (タイトルから判定)
      const lowerTitle = title.toLowerCase();
      if (lowerTitle.includes('字幕')) screenFormat += ' / 字幕';
      else if (lowerTitle.includes('吹替')) screenFormat += ' / 吹替';
      screenFormat = screenFormat.replace(/^2D \/ /, '');

      // 各上映回 (li.check_date)
      const checkDatePattern = /<li[^>]+class="[^"]*check_date[^"]*"[^>]*>([\s\S]*?)(?=<li|<\/ul>|$)/gi;
      let cdMatch;

      while ((cdMatch = checkDatePattern.exec(ulContent)) !== null) {
        const cdContent = cdMatch[1];

        // 開始・終了時刻
        const startMatch = /<[^>]+class="[^"]*start[^"]*"[^>]*>([\s\S]*?)<\/[^>]+>/i.exec(cdContent);
        const endMatch = /<[^>]+class="[^"]*end[^"]*"[^>]*>([\s\S]*?)<\/[^>]+>/i.exec(cdContent);
        if (!startMatch || !endMatch) continue;

        const startTime = stripHtml(startMatch[1]).trim();
        const endTime = stripHtml(endMatch[1]).trim();
        if (!startTime || !startTime.match(/\d{1,2}:\d{2}/)) continue;

        // 予約リンク
        const linkMatch = /href="([^"]+)"/i.exec(cdContent);
        let reserveUrl = 'https://109cinemas.net/grandberrypark/';
        if (linkMatch) {
          const rawHref = linkMatch[1].replace(/&amp;/g, '&');
          reserveUrl = rawHref.startsWith('http') ? rawHref : siteBase + rawHref;
        }

        // 空席ステータス
        let status = '-';
        let statusText = '不明';
        if (cdContent.includes('class="available"') || cdContent.includes("class='available'")) {
          status = '◎'; statusText = '空席あり';
        } else if (cdContent.includes('class="remaining"') || cdContent.includes("class='remaining'")) {
          status = '△'; statusText = '残りわずか';
        } else if (cdContent.includes('class="soldout"') || cdContent.includes("class='soldout'")) {
          status = '×'; statusText = '完売';
        } else if (linkMatch) {
          status = '◯'; statusText = '予約可能';
        }

        schedules.push({
          time: `${startTime}-${endTime}`,
          startTime: startTime,
          endTime: endTime,
          screen: screenName,
          format: screenFormat,
          status: status,
          statusText: statusText,
          reserveUrl: reserveUrl
        });
      }
    }

    // パターン2: 新構造 (ul.timetable がない、または見つからなかった場合)
    if (!hasUlTimetable || schedules.length === 0) {
      // <time>08:45</time> ~ <time>10:55</time> または時刻パターンを抽出
      // シアター情報をコンテキストから取得
      const theaterNumMatches = Array.from(fullArticleHtml.matchAll(/シアター(?:<\/a>)?\s*(?:<span>)?(\d+)/gi));
      const currentTheaterNum = theaterNumMatches.length > 0 ? theaterNumMatches[0][1] : '';
      let defaultScreen = currentTheaterNum ? `シアター${currentTheaterNum}` : 'スクリーン';

      let defaultFormat = '2D';
      const upperArticle = fullArticleHtml.toUpperCase();
      if (upperArticle.includes('IMAX')) defaultFormat = 'IMAX';
      else if (upperArticle.includes('4DX')) defaultFormat = '4DX';
      else if (upperArticle.includes('SAION')) defaultFormat = 'SAION';
      else if (upperArticle.includes('3D')) defaultFormat = '3D';

      if (title.toLowerCase().includes('字幕')) defaultFormat += ' / 字幕';
      else if (title.toLowerCase().includes('吹替')) defaultFormat += ' / 吹替';
      defaultFormat = defaultFormat.replace(/^2D \/ /, '');

      // <time>HH:MM</time> ... <time>HH:MM</time> の組み合わせ
      const timeTagPattern = /<time[^>]*>(\d{1,2}:\d{2})<\/time>[\s\S]*?<time[^>]*>(\d{1,2}:\d{2})<\/time>/gi;
      let timeMatch;
      while ((timeMatch = timeTagPattern.exec(fullArticleHtml)) !== null) {
        const startTime = timeMatch[1];
        const endTime = timeMatch[2];

        // この上映回周辺のHTML（リンクや購入ボタン、シアター特定）を探索
        const contextStart = Math.max(0, timeMatch.index - 300);
        const contextEnd = Math.min(fullArticleHtml.length, timeMatch.index + 300);
        const surroundingHtml = fullArticleHtml.substring(contextStart, contextEnd);

        // シアター番号のローカル特定
        let screen = defaultScreen;
        const localTheater = /シアター(?:<\/a>)?\s*(?:<span>)?(\d+)/i.exec(surroundingHtml);
        if (localTheater) {
          screen = `シアター${localTheater[1]}`;
        }

        // 音響/フォーマットのローカル特定
        let itemFormat = defaultFormat;
        const upperSurrounding = surroundingHtml.toUpperCase();
        if (upperSurrounding.includes('IMAX')) itemFormat = 'IMAX';
        else if (upperSurrounding.includes('4DX')) itemFormat = '4DX';
        else if (upperSurrounding.includes('SAION')) itemFormat = 'SAION';
        if (title.toLowerCase().includes('字幕') && !itemFormat.includes('字幕')) itemFormat += ' / 字幕';
        else if (title.toLowerCase().includes('吹替') && !itemFormat.includes('吹替')) itemFormat += ' / 吹替';
        itemFormat = itemFormat.replace(/^2D \/ /, '');

        // 予約リンク
        let reserveUrl = 'https://109cinemas.net/grandberrypark/';
        const linkMatch = /href="([^"]*resv_shw_ppt[^"]*)"/i.exec(surroundingHtml) || /href="([^"]+)"/i.exec(surroundingHtml);
        if (linkMatch) {
          const rawHref = linkMatch[1].replace(/&amp;/g, '&');
          reserveUrl = rawHref.startsWith('http') ? rawHref : siteBase + rawHref;
        }

        // ステータス判定
        let status = '◯';
        let statusText = '予約可能';
        if (surroundingHtml.includes('販売終了')) {
          status = '×';
          statusText = '販売終了';
        } else if (surroundingHtml.includes('購入') || linkMatch) {
          status = '◯';
          statusText = '購入可能';
        }

        schedules.push({
          time: `${startTime}-${endTime}`,
          startTime: startTime,
          endTime: endTime,
          screen: screen,
          format: itemFormat,
          status: status,
          statusText: statusText,
          reserveUrl: reserveUrl
        });
      }
    }

    if (schedules.length > 0) {
      const existing = movies.find(m => m.title === title);
      if (existing) {
        existing.schedules.push(...schedules);
      } else {
        movies.push({ title, schedules });
      }
    }
  }

  // 時間順にソート
  movies.forEach(m => {
    m.schedules.sort((a, b) => a.startTime.localeCompare(b.startTime));
  });

  return movies;
}

// ============================================================
// イオンシネマ（既存）
// ============================================================

/**
 * イオンシネマ公式スケジュールJSONフェッチ
 */
async function fetchAeonOfficialSchedule(cinemaId, dateStr) {
  const code = cinemaId.includes('zama') ? 'zama' : 'shinyurigaoka';
  const cinemaName = cinemaId.includes('zama') ? 'イオンシネマ 座間' : 'イオンシネマ 新百合ヶ丘';

  const v = getTimestampParam();
  const targetUrl = `https://theater.aeoncinema.com/schedule/v2/data/${code}/schedule.json?v=${v}`;

  const response = await fetch(targetUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      'Accept': 'application/json, text/plain, */*',
      'Referer': `https://theater.aeoncinema.com/theaters/${code}/?date=${dateStr}`
    }
  });

  if (!response.ok) {
    throw new Error(`イオンシネマ公式APIからの取得に失敗しました (Status: ${response.status})`);
  }

  const json = await response.json();
  const movies = parseAeonScheduleJson(json, dateStr, `https://theater.aeoncinema.com/theaters/${code}/?date=${dateStr}`);

  return {
    cinemaId: cinemaId,
    cinemaName: cinemaName,
    targetDate: dateStr,
    fetchedAt: new Date().toISOString(),
    movies: movies
  };
}

/**
 * イオンシネマ公式 JSON パーサー
 */
function parseAeonScheduleJson(json, dateStr, reserveUrl) {
  const moviesMap = new Map();
  const dateData = json[dateStr];

  if (!dateData) return [];

  for (const groupKey in dateData) {
    const slots = dateData[groupKey];
    if (!Array.isArray(slots)) continue;

    for (const slot of slots) {
      if (!slot.name || !slot.name.ja) continue;

      let rawTitle = slot.name.ja
        .replace(/^(?:字幕|吹替|IMAX|4DX|3D|2D|ULTIRA|［字幕］|［吹替］|【字幕】|【吹替】)\s*/i, '')
        .replace(/\s+/g, ' ')
        .trim();

      if (!rawTitle) continue;

      const startUtc = new Date(slot.startDate);
      const endUtc = new Date(slot.endDate);
      const startJst = new Date(startUtc.getTime() + 9 * 60 * 60 * 1000);
      const endJst = new Date(endUtc.getTime() + 9 * 60 * 60 * 1000);

      const startTimeStr = formatTime(startJst);
      const endTimeStr = formatTime(endJst);
      const fullTimeStr = `${startTimeStr} - ${endTimeStr}`;

      const totalCap = slot.maximumAttendeeCapacity || 100;
      const remainCap = slot.remainingAttendeeCapacity || 0;
      const ratio = remainCap / totalCap;

      let status = '◯';
      let statusText = '予約可能';

      if (remainCap === 0) {
        status = '×'; statusText = '満席';
      } else if (ratio > 0.5) {
        status = '◎'; statusText = '余裕あり';
      } else if (ratio <= 0.2) {
        status = '△'; statusText = '残りわずか';
      }

      const screenName = (slot.location && slot.location.name && slot.location.name.ja)
        ? slot.location.name.ja
        : 'スクリーン';

      let format = '2D';
      if (slot.name.ja.includes('3D')) format = '3D';
      else if (slot.name.ja.includes('字幕')) format = '2D / 字幕';
      else if (slot.name.ja.includes('吹替')) format = '2D / 吹替';

      const scheduleObj = {
        time: fullTimeStr,
        startTime: startTimeStr,
        endTime: endTimeStr,
        screen: screenName,
        format: format,
        status: status,
        statusText: statusText,
        reserveUrl: reserveUrl
      };

      if (!moviesMap.has(rawTitle)) {
        moviesMap.set(rawTitle, { title: rawTitle, schedules: [] });
      }
      moviesMap.get(rawTitle).schedules.push(scheduleObj);
    }
  }

  const resultMovies = Array.from(moviesMap.values());
  resultMovies.forEach(m => {
    m.schedules.sort((a, b) => a.startTime.localeCompare(b.startTime));
  });

  return resultMovies;
}

// ============================================================
// ユーティリティ
// ============================================================

/**
 * HTMLタグを除去してプレーンテキストを返す
 */
function stripHtml(html) {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function formatTime(dateObj) {
  const hh = String(dateObj.getUTCHours()).padStart(2, '0');
  const mm = String(dateObj.getUTCMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function getTodayStr() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
}

function getTimestampParam() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  return `${yyyy}${mm}${dd}${hh}${min}`;
}
