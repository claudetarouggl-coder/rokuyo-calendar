"use strict";
// 干支・一粒万倍日・天赦日の計算
// 方式:
//   1. 日の干支は60日周期。dayNumber(y,m,d) = floor(UTC(y,m,d)/86400000) として
//      index = (dayNumber + OFFSET) mod 60 （OFFSET=17 は複数の公表日付から実測で校正、self-check参照）
//   2. 節月（立春起点の節切り月）は、節（黄経15°刻みの奇数節: 立春315°,啓蟄345°,清明15°...）の
//      瞬間を lib/kyureki.js の nextSolarTerm で求め、そのJST日付を月替わり境界とする（節入り日から新しい月）
//   3. 天赦日 = 季節（節月を3ヶ月ずつ四季に束ねる）ごとに定められた干支の日
//   4. 一粒万倍日 = 節月ごとに定められた2つの十二支の日
const { nextSolarTerm, jstDate } = require("./kyureki");

const JIKKAN = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];
const JUNISHI = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];
const OFFSET = 17; // 校正値。self-check参照

const dayNumber = (y, m, d) => Math.floor(Date.UTC(y, m - 1, d) / 86400000);

function dayKanshi(y, m, d) {
  const idx = ((dayNumber(y, m, d) + OFFSET) % 60 + 60) % 60;
  const kan = JIKKAN[idx % 10];
  const shi = JUNISHI[idx % 12];
  return { kan, shi, name: kan + shi };
}

// 節（節切り月の境界）: 立春315°を節月1の開始とし、以降30°刻み
const SETSU_DEG = [315, 345, 15, 45, 75, 105, 135, 165, 195, 225, 255, 285];

// 節入りテーブルのキャッシュ（年範囲ごとに一度だけ計算）
let setsuTable = null; // [{day, monthIdx(0-11)}] day昇順
let setsuRange = null;

function buildSetsuTable(fromYear, toYear) {
  const table = [];
  let t = Date.UTC(fromYear - 2, 0, 1);
  let degIdx = 0;
  const limitMs = Date.UTC(toYear + 1, 11, 31);
  while (t < limitMs) {
    const deg = SETSU_DEG[degIdx];
    const ms = nextSolarTerm(t, deg);
    const jd = jstDate(ms);
    table.push({ day: dayNumber(jd.y, jd.m, jd.d), monthIdx: degIdx });
    t = ms + 86400000;
    degIdx = (degIdx + 1) % 12;
  }
  return table;
}

function ensureSetsuTable(y) {
  if (!setsuRange || y < setsuRange[0] || y > setsuRange[1]) {
    const from = Math.min(y, setsuRange ? setsuRange[0] : y) - 1;
    const to = Math.max(y, setsuRange ? setsuRange[1] : y) + 1;
    setsuTable = buildSetsuTable(from, to);
    setsuRange = [from, to];
  }
}

// 節月（1〜12、立春起点）
function setsugetsu(y, m, d) {
  ensureSetsuTable(y);
  const day = dayNumber(y, m, d);
  let cur = setsuTable[0];
  for (const entry of setsuTable) {
    if (entry.day > day) break;
    cur = entry;
  }
  return cur.monthIdx + 1;
}

// 一粒万倍日: 節月ごとの十二支2つ（要検証・公開リストで校正済み、self-check参照）
const ICHIRYU_TABLE = {
  1: ["丑", "午"], 2: ["酉", "寅"], 3: ["子", "卯"], 4: ["卯", "辰"],
  5: ["巳", "午"], 6: ["酉", "午"], 7: ["子", "未"], 8: ["卯", "申"],
  9: ["酉", "午"], 10: ["酉", "戌"], 11: ["亥", "子"], 12: ["卯", "子"],
};

function isIchiryumanbai(y, m, d) {
  const sg = setsugetsu(y, m, d);
  const { shi } = dayKanshi(y, m, d);
  return ICHIRYU_TABLE[sg].includes(shi);
}

// 天赦日: 四季（節月を3ヶ月ずつ束ねる）ごとの干支の日
const TENSHA_KANSHI = { 1: "戊寅", 2: "甲午", 3: "戊申", 4: "甲子" }; // 春,夏,秋,冬

function isTenshabi(y, m, d) {
  const sg = setsugetsu(y, m, d);
  const season = Math.ceil(sg / 3);
  const { name } = dayKanshi(y, m, d);
  return name === TENSHA_KANSHI[season];
}

module.exports = { dayKanshi, setsugetsu, isIchiryumanbai, isTenshabi, JIKKAN, JUNISHI };

// ---- 自己検証 ----
if (require.main === module) {
  const assert = require("assert");

  // 校正アンカー: 公表サイト（koyomishokunin.com / hamaken.site 経由）の日の干支と一致するか
  const anchors = [
    [2026, 1, 1, "乙亥"],
    [2026, 4, 1, "乙巳"],
    [2026, 7, 1, "丙子"],
    [2026, 10, 1, "戊申"],
    [2026, 12, 25, "癸酉"],
  ];
  for (const [y, m, d, name] of anchors) {
    const r = dayKanshi(y, m, d);
    assert.strictEqual(r.name, name, `dayKanshi ${y}-${m}-${d}: got ${r.name}, want ${name}`);
  }

  // 天赦日 2026年（clndr.jp・mwed.jp 一致）
  const TENSHA_2026 = [[3, 5], [5, 4], [5, 20], [7, 19], [10, 1], [12, 16]];
  // 天赦日 2027年（mwed.jp・taian-calendar.com・irodorica.com 一致）
  const TENSHA_2027 = [[2, 28], [4, 29], [5, 15], [7, 14], [9, 26], [12, 11]];

  for (const [y, list] of [[2026, TENSHA_2026], [2027, TENSHA_2027]]) {
    const computed = [];
    for (let m = 1; m <= 12; m++) {
      const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
      for (let d = 1; d <= last; d++) if (isTenshabi(y, m, d)) computed.push([m, d]);
    }
    assert.deepStrictEqual(computed, list, `tenshabi ${y}: got ${JSON.stringify(computed)}, want ${JSON.stringify(list)}`);
  }

  // 一粒万倍日: 2026年・2027年から抜粋した検証用日付（8件以上、両年にまたがる）
  // 出典: clndr.jp/ichiryumanbai, mwed.jp/articles/12629（2026）, benri.jp/calc/manbai, irodorica.com（2027）
  const ICHIRYU_SPOT = [
    [2026, 1, 1], [2026, 1, 2], [2026, 3, 5], [2026, 7, 19], [2026, 10, 1], [2026, 12, 16],
    [2027, 1, 9], [2027, 5, 12], [2027, 7, 14], [2027, 9, 26], [2027, 12, 11],
  ];
  for (const [y, m, d] of ICHIRYU_SPOT) {
    assert.ok(isIchiryumanbai(y, m, d), `expected ichiryumanbai on ${y}-${m}-${d}`);
  }
  // 非該当日の確認（各年1件）
  assert.ok(!isIchiryumanbai(2026, 1, 3), "2026-01-03 should not be ichiryumanbai");
  assert.ok(!isIchiryumanbai(2027, 1, 1), "2027-01-01 should not be ichiryumanbai");

  console.log("kanshi.js self-check OK (offset=17 anchors, tenshabi 2026/2027 full match, ichiryumanbai spot-check)");
}
