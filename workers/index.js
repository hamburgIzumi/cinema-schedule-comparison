/**
 * @file index.js (Cloudflare Workers)
 * @description イオンシネマ専用 公式リアルタイムスケジュールAPIプロキシ
 * (https://theater.aeoncinema.com/schedule/v2/data/{code}/schedule.json より本物データ抽出)
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
      const resultData = await fetchAeonOfficialSchedule(cinemaId, dateStr);

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
 * イオンシネマ公式スケジュールJSONフェッチ (08:20~10:10 等の実時刻取得)
 */
async function fetchAeonOfficialSchedule(cinemaId, dateStr) {
  const code = cinemaId.includes('zama') ? 'zama' : 'shinyurigaoka';
  const cinemaName = cinemaId.includes('zama') ? "イオンシネマ 座間" : "イオンシネマ 新百合ヶ丘";

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

  // 各映画グループ ID をループ処理
  for (const groupKey in dateData) {
    const slots = dateData[groupKey];
    if (!Array.isArray(slots)) continue;

    for (const slot of slots) {
      if (!slot.name || !slot.name.ja) continue;

      // 作品名の整形 (例: "吹替　君と花火と約束と" -> "君と花火と約束と")
      let rawTitle = slot.name.ja
        .replace(/^(?:字幕|吹替|IMAX|4DX|3D|2D|ULTIRA|［字幕］|［吹替］|【字幕】|【吹替】)\s*/i, '')
        .replace(/\s+/g, ' ')
        .trim();

      if (!rawTitle) continue;

      // 日本時間 (JST: UTC+9) への変換
      const startUtc = new Date(slot.startDate);
      const endUtc = new Date(slot.endDate);

      const startJst = new Date(startUtc.getTime() + 9 * 60 * 60 * 1000);
      const endJst = new Date(endUtc.getTime() + 9 * 60 * 60 * 1000);

      const startTimeStr = formatTime(startJst);
      const endTimeStr = formatTime(endJst);
      const fullTimeStr = `${startTimeStr} - ${endTimeStr}`;

      // 残席数・空席ステータスの計算
      const totalCap = slot.maximumAttendeeCapacity || 100;
      const remainCap = slot.remainingAttendeeCapacity || 0;
      const ratio = remainCap / totalCap;

      let status = '◯';
      let statusText = '予約可能';

      if (remainCap === 0) {
        status = '×';
        statusText = '満席';
      } else if (ratio > 0.5) {
        status = '◎';
        statusText = '余裕あり';
      } else if (ratio <= 0.2) {
        status = '△';
        statusText = '残りわずか';
      }

      // スクリーン名
      const screenName = (slot.location && slot.location.name && slot.location.name.ja)
        ? slot.location.name.ja
        : 'スクリーン';

      // フォーマット判定
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
        moviesMap.set(rawTitle, {
          title: rawTitle,
          schedules: []
        });
      }

      moviesMap.get(rawTitle).schedules.push(scheduleObj);
    }
  }

  // 時間順にソート
  const resultMovies = Array.from(moviesMap.values());
  resultMovies.forEach(m => {
    m.schedules.sort((a, b) => a.startTime.localeCompare(b.startTime));
  });

  return resultMovies;
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
