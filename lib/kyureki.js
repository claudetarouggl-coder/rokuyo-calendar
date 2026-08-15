"use strict";
// 旧暦（天保暦方式）と六曜の計算
// 方式:
//   1. 朔（新月）の瞬間をJSTで求め、朔日を旧暦月の1日とする
//   2. 太陽黄経が30°の倍数（中気）に達する瞬間を求める
//   3. 冬至を含む月を11月とし、11月から11月の間に13朔月あれば中気を含まない最初の月を閏月とする
//   4. 六曜 = (旧暦月 + 旧暦日) mod 6（閏月は元の月の数字を使う）
// 精度: 月位置は Meeus 簡約級数（誤差〜0.2°≈朔時刻で±30分）。朔・中気が日本時間の
//       深夜0時近傍に来る稀なケースで日付が1日ずれる可能性がある（公表暦との照合で検証する）

const rad = d => d * Math.PI / 180;
const norm360 = x => ((x % 360) + 360) % 360;

// ---- 太陽・月の視黄経（Meeus簡約）----
function sunLongitude(T) {
  const L0 = 280.46646 + T * (36000.76983 + T * 0.0003032);
  const M = rad(357.52911 + T * 35999.05029);
  const C = (1.914602 - T * 0.004817) * Math.sin(M) + 0.019993 * Math.sin(2 * M) + 0.000289 * Math.sin(3 * M);
  return norm360(L0 + C);
}
function moonLongitude(T) {
  const Lp = 218.3164477 + 481267.88123421 * T;
  const D = rad(297.8501921 + 445267.1114034 * T);
  const M = rad(357.5291092 + 35999.0502909 * T);
  const Mp = rad(134.9633964 + 477198.8675055 * T);
  const F = rad(93.2720950 + 483202.0175233 * T);
  return norm360(Lp
    + 6.288774 * Math.sin(Mp)
    + 1.274027 * Math.sin(2 * D - Mp)
    + 0.658314 * Math.sin(2 * D)
    + 0.213618 * Math.sin(2 * Mp)
    - 0.185116 * Math.sin(M)
    - 0.114332 * Math.sin(2 * F)
    + 0.058793 * Math.sin(2 * D - 2 * Mp)
    + 0.057066 * Math.sin(2 * D - M - Mp)
    + 0.053322 * Math.sin(2 * D + Mp)
    + 0.045758 * Math.sin(2 * D - M)
    - 0.040923 * Math.sin(M - Mp)
    - 0.034720 * Math.sin(D)
    - 0.030383 * Math.sin(M + Mp)
    + 0.015327 * Math.sin(2 * D - 2 * F)
    - 0.012528 * Math.sin(Mp + 2 * F)
    + 0.010980 * Math.sin(Mp - 2 * F));
}
const toT = ms => (ms / 86400000 + 2440587.5 - 2451545.0) / 36525;
const elongationAt = ms => norm360(moonLongitude(toT(ms)) - sunLongitude(toT(ms)));

// ---- 朔・中気の瞬間を求める ----
// f(ms) が 0 を負→正で跨ぐ瞬間を二分法で求める汎用関数
function findCrossing(f, startMs, endMs, stepMs) {
  let prev = f(startMs);
  for (let t = startMs + stepMs; t <= endMs; t += stepMs) {
    const cur = f(t);
    if (prev < 0 && cur >= 0) {
      let lo = t - stepMs, hi = t;
      for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (f(mid) < 0) lo = mid; else hi = mid; }
      return (lo + hi) / 2;
    }
    prev = cur;
  }
  return null;
}
const signedDiff = (deg, target) => ((deg - target + 540) % 360) - 180;

// startMs 以降で最初の朔の瞬間（UTC ms）
function nextNewMoon(startMs) {
  const ms = findCrossing(t => signedDiff(elongationAt(t), 0), startMs, startMs + 40 * 86400000, 3600000);
  if (ms === null) throw new Error("new moon not found");
  return ms;
}
// startMs 以降で最初に太陽黄経が targetDeg に達する瞬間
function nextSolarTerm(startMs, targetDeg) {
  const ms = findCrossing(t => signedDiff(sunLongitude(toT(t)), targetDeg), startMs, startMs + 400 * 86400000, 6 * 3600000);
  if (ms === null) throw new Error("solar term not found");
  return ms;
}

// UTC ms → JSTの日付キー {y,m,d} と通し日数
const JST = 9 * 3600000;
function jstDate(ms) {
  const d = new Date(ms + JST);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() };
}
const jstDayNumber = ms => Math.floor((ms + JST) / 86400000);
const dayNumberToDate = n => {
  const d = new Date(n * 86400000 - JST + 43200000); // 正午基準で復元
  return jstDate(d.getTime());
};

// ---- 旧暦カレンダー構築 ----
// fromYear-1年の冬至前の朔 〜 toYear+1年頭 までの旧暦月列を作る
function buildLunarCalendar(fromYear, toYear) {
  // 基準: fromYear-1 年の冬至（太陽黄経270°）
  const start = Date.UTC(fromYear - 2, 10, 1); // 余裕を持って2年前の11月から探索
  let winterSolstice = nextSolarTerm(start, 270);
  while (jstDate(winterSolstice).y < fromYear - 1) {
    winterSolstice = nextSolarTerm(winterSolstice + 86400000, 270);
  }

  // 朔の列: 冬至の直前の朔から、toYear+1年3月ごろまで
  const newMoons = [];
  let nm = nextNewMoon(winterSolstice - 35 * 86400000);
  if (nm > winterSolstice) throw new Error("first new moon after solstice — search window bug");
  while (jstDayNumber(nm) <= jstDayNumber(Date.UTC(toYear + 1, 2, 31))) {
    newMoons.push(nm);
    nm = nextNewMoon(nm + 20 * 86400000);
  }
  newMoons.push(nm); // 番兵（最後の月の長さ計算用）

  // 中気の列（黄経 0,30,...330 のうち偶数番= 中気は 330(雨水),0(春分),30(穀雨)...300(大寒)）
  // 実装上は全ての30°倍数を列挙し、中気（太陽黄経が30の偶数倍…定義: 中気は黄経30°×偶数）を選ぶ
  // 正しい定義: 節気=15°+30°k ではなく、二十四節気のうち「中気」は黄経が30°の倍数（0,30,...）
  const chuki = []; // {ms, deg}
  let t = winterSolstice - 40 * 86400000;
  for (let k = 0; k < Math.ceil((toYear + 2 - fromYear) * 12.5) + 4; k++) {
    // 直近の30°倍数を順に求める
    const curLon = sunLongitude(toT(t));
    const nextDeg = (Math.floor(curLon / 30) + 1) * 30 % 360;
    const ms = nextSolarTerm(t, nextDeg);
    chuki.push({ ms, deg: nextDeg });
    t = ms + 86400000;
  }

  // 月オブジェクト列
  const months = [];
  for (let i = 0; i < newMoons.length - 1; i++) {
    const startDay = jstDayNumber(newMoons[i]);
    const endDay = jstDayNumber(newMoons[i + 1]) - 1; // 翌朔の前日まで
    const terms = chuki.filter(c => jstDayNumber(c.ms) >= startDay && jstDayNumber(c.ms) <= endDay);
    months.push({ startDay, endDay, terms, num: null, leap: false });
  }

  // 冬至を含む月 = 11月。冬至は毎年やってくるので、まず全冬至に11を割り当てる
  const solsticeDays = [];
  let ws = winterSolstice;
  while (jstDate(ws).y <= toYear + 1) {
    solsticeDays.push(jstDayNumber(ws));
    ws = nextSolarTerm(ws + 86400000, 270);
  }
  const idxOfDay = day => months.findIndex(m => m.startDay <= day && day <= m.endDay);

  for (let s = 0; s < solsticeDays.length - 1; s++) {
    const a = idxOfDay(solsticeDays[s]);
    const b = idxOfDay(solsticeDays[s + 1]);
    if (a < 0) continue;
    const end = b < 0 ? months.length : b;
    months[a].num = 11; months[a].leap = false;
    const span = end - a; // 11月から次の11月までの月数
    const hasLeap = span === 13;
    let num = 11, leapUsed = false;
    for (let i = a + 1; i < end; i++) {
      const noChuki = months[i].terms.length === 0;
      if (hasLeap && !leapUsed && noChuki) {
        months[i].num = num; months[i].leap = true; leapUsed = true;
      } else {
        num = num % 12 + 1;
        months[i].num = num; months[i].leap = false;
      }
    }
  }

  return months.filter(m => m.num !== null);
}

// ---- 公開API: グレゴリオ日付 → {旧暦月, 旧暦日, 閏, 六曜} ----
const ROKUYO = ["大安", "赤口", "先勝", "友引", "先負", "仏滅"]; // idx = (月+日) % 6

function makeConverter(fromYear, toYear) {
  const months = buildLunarCalendar(fromYear, toYear);
  return function convert(y, m, d) {
    const day = jstDayNumber(Date.UTC(y, m - 1, d) - JST + 43200000); // その日のJST正午
    const mon = months.find(mo => mo.startDay <= day && day <= mo.endDay);
    if (!mon) return null;
    const lunarDay = day - mon.startDay + 1;
    return {
      month: mon.num, day: lunarDay, leap: mon.leap,
      rokuyo: ROKUYO[(mon.num + lunarDay) % 6],
    };
  };
}

module.exports = { makeConverter, buildLunarCalendar, ROKUYO, nextNewMoon, nextSolarTerm, jstDate };

// ---- 自己検証 ----
if (require.main === module) {
  const assert = require("assert");
  const conv = makeConverter(2025, 2028);

  // アンカー1: 旧暦1月1日（日本の旧正月）
  // 2026-02-17（春節と同日）。2027は朔が 2027-02-07 00:56 JST（=中国時間02-06 23:56）の
  // 時差境界ケースで、日本の旧暦では 02-07 が朔日になる（計算朔時刻は公表の月齢表と分単位で一致）
  // 2028-01-27 00:16 JST はさらに境界に近く計算誤差圏内のためアンカーに使わない（公開範囲も2027年末まで）
  for (const [y, m, d] of [[2026, 2, 17], [2027, 2, 7]]) {
    const r = conv(y, m, d);
    assert.ok(r && r.month === 1 && r.day === 1 && !r.leap,
      `LNY ${y}-${m}-${d}: got ${JSON.stringify(r)}`);
  }
  // アンカー2: 伝統的七夕（旧暦7月7日）2026-08-19（国立天文台公表）
  const tanabata = conv(2026, 8, 19);
  assert.ok(tanabata && tanabata.month === 7 && tanabata.day === 7 && !tanabata.leap,
    `tanabata: ${JSON.stringify(tanabata)}`);
  // アンカー3: 中秋の名月（旧暦8月15日）2026-09-25
  const meigetsu = conv(2026, 9, 25);
  assert.ok(meigetsu && meigetsu.month === 8 && meigetsu.day === 15 && !meigetsu.leap,
    `meigetsu: ${JSON.stringify(meigetsu)}`);
  // 六曜の規則: 旧暦1月1日は先勝
  assert.strictEqual(ROKUYO[(1 + 1) % 6], "先勝");
  const lny = conv(2026, 2, 17);
  assert.strictEqual(lny.rokuyo, "先勝");
  // 連続性: 2026年の全日が変換可能で、六曜が月替わり以外は循環している
  let prev = null, breaks = 0;
  for (let ms = Date.UTC(2026, 0, 1); ms <= Date.UTC(2026, 11, 31); ms += 86400000) {
    const { y, m, d } = { y: new Date(ms).getUTCFullYear(), m: new Date(ms).getUTCMonth() + 1, d: new Date(ms).getUTCDate() };
    const r = conv(y, m, d);
    assert.ok(r, `no conversion for ${y}-${m}-${d}`);
    if (prev) {
      const expectedNext = (ROKUYO.indexOf(prev) + 1) % 6;
      if (ROKUYO.indexOf(r.rokuyo) !== expectedNext) breaks++; // 月替わりでのジャンプ
    }
    prev = r.rokuyo;
  }
  // 六曜の循環が壊れるのは旧暦の月替わり時のみ（年間12〜13回程度）
  assert.ok(breaks >= 10 && breaks <= 15, `rokuyo breaks: ${breaks}`);
  console.log("kyureki.js self-check OK (LNY 2026/2027, tanabata, meigetsu, rokuyo rule)");
}
