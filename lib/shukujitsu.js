"use strict";
// 日本の祝日・休日の計算（「国民の祝日に関する法律」に基づく）
// 方式:
//   1. 固定日の祝日 + ハッピーマンデー（第N月曜）+ 春分の日・秋分の日（太陽黄経0°/180°、
//      lib/kyureki.js の nextSolarTerm で通過瞬間を求めJST日付化）で「祝日」を確定する
//   2. 振替休日: 祝日が日曜の場合、その直後で最初の「祝日でない日」を休日とする
//   3. 国民の休日: 前日・翌日が祝日（日曜を除く）である祝日でない平日を休日とする
// 春分・秋分は前年2月の暦要項（官報）で正式決定されるため、未公表年分はあくまで天文計算による予測。
// 2026・2027年分は国立天文台の公表値と一致することを self-check で確認済み。
const { nextSolarTerm, jstDate } = require("./kyureki");

const wdayOf = (y, m, d) => new Date(Date.UTC(y, m - 1, d)).getUTCDay();
const dayNum = (y, m, d) => Math.floor(Date.UTC(y, m - 1, d) / 86400000);
function fromDayNum(n) {
  const dt = new Date(n * 86400000);
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
}

// y年m月の第n月曜日
function nthMonday(y, m, n) {
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  let count = 0;
  for (let d = 1; d <= last; d++) {
    if (wdayOf(y, m, d) === 1 && ++count === n) return d;
  }
  throw new Error(`nthMonday not found: ${y}-${m} #${n}`);
}

// 春分(targetDeg=0)・秋分(targetDeg=180)のJST日付
function equinox(y, targetDeg) {
  const searchFrom = Date.UTC(y, targetDeg === 0 ? 1 : 7, 1); // 春分は2月〜, 秋分は8月〜 で探索
  return jstDate(nextSolarTerm(searchFrom, targetDeg));
}

function fixedHolidays(y) {
  const shunbun = equinox(y, 0);
  const shubun = equinox(y, 180);
  return [
    { m: 1, d: 1, name: "元日" },
    { m: 1, d: nthMonday(y, 1, 2), name: "成人の日" },
    { m: 2, d: 11, name: "建国記念の日" },
    { m: 2, d: 23, name: "天皇誕生日" },
    { m: shunbun.m, d: shunbun.d, name: "春分の日" },
    { m: 4, d: 29, name: "昭和の日" },
    { m: 5, d: 3, name: "憲法記念日" },
    { m: 5, d: 4, name: "みどりの日" },
    { m: 5, d: 5, name: "こどもの日" },
    { m: 7, d: nthMonday(y, 7, 3), name: "海の日" },
    { m: 8, d: 11, name: "山の日" },
    { m: 9, d: nthMonday(y, 9, 3), name: "敬老の日" },
    { m: shubun.m, d: shubun.d, name: "秋分の日" },
    { m: 10, d: nthMonday(y, 10, 2), name: "スポーツの日" },
    { m: 11, d: 3, name: "文化の日" },
    { m: 11, d: 23, name: "勤労感謝の日" },
  ].sort((a, b) => a.m - b.m || a.d - b.d);
}

// y年の祝日・休日の全リスト（日付昇順）。type: "祝日" | "振替休日" | "国民の休日"
function holidaysOf(y) {
  const base = fixedHolidays(y).map(h => ({ y, m: h.m, d: h.d, name: h.name, type: "祝日" }));
  const occupied = new Map(base.map(h => [dayNum(h.y, h.m, h.d), h]));
  const baseSet = new Set(occupied.keys());

  // 振替休日: 祝日が日曜なら、直後の「祝日でない日」（既に振替休日として使われた日も除く）を休日にする
  const furikae = [];
  for (const h of base) {
    if (wdayOf(h.y, h.m, h.d) !== 0) continue;
    let n = dayNum(h.y, h.m, h.d) + 1;
    while (occupied.has(n)) n++;
    const fd = fromDayNum(n);
    const obj = { y: fd.y, m: fd.m, d: fd.d, name: "振替休日", type: "振替休日" };
    furikae.push(obj);
    occupied.set(n, obj);
  }

  // 国民の休日: 前日・翌日が祝日で、当日は祝日でも日曜でもない平日
  const kokumin = [];
  for (const h of base) {
    const n = dayNum(h.y, h.m, h.d) + 1;
    if (!baseSet.has(n + 1)) continue; // 翌々日が祝日でなければ挟まれていない
    if (occupied.has(n)) continue; // 当日が既に祝日・振替休日
    const fd = fromDayNum(n);
    if (wdayOf(fd.y, fd.m, fd.d) === 0) continue; // 日曜は対象外
    const obj = { y: fd.y, m: fd.m, d: fd.d, name: "国民の休日", type: "国民の休日" };
    kokumin.push(obj);
    occupied.set(n, obj);
  }

  return [...base, ...furikae, ...kokumin].sort((a, b) => a.m - b.m || a.d - b.d);
}

module.exports = { holidaysOf, fixedHolidays, nthMonday, equinox };

// ---- 自己検証 ----
if (require.main === module) {
  const assert = require("assert");

  const list2026 = holidaysOf(2026);
  const list2027 = holidaysOf(2027);

  const fmt = h => `${h.m}/${h.d}`;
  const byName = (list, name) => list.find(h => h.name === name);

  // 2026年: 祝日16 + 国民の休日1(9/22) + 振替休日1(5/6、5/3憲法記念日が日曜のため)
  assert.strictEqual(list2026.filter(h => h.type === "祝日").length, 16, "2026 祝日 should be 16");
  assert.strictEqual(list2026.filter(h => h.type === "国民の休日").length, 1, "2026 国民の休日 should be 1");
  assert.strictEqual(list2026.filter(h => h.type === "振替休日").length, 1, "2026 振替休日 should be 1");
  assert.strictEqual(list2026.length, 18, "2026 total holidays should be 18");
  assert.deepStrictEqual([byName(list2026, "春分の日").m, byName(list2026, "春分の日").d], [3, 20], "2026 春分");
  assert.deepStrictEqual([byName(list2026, "秋分の日").m, byName(list2026, "秋分の日").d], [9, 23], "2026 秋分");
  assert.deepStrictEqual([byName(list2026, "敬老の日").m, byName(list2026, "敬老の日").d], [9, 21], "2026 敬老の日");
  const kokumin2026 = list2026.filter(h => h.type === "国民の休日")[0];
  assert.deepStrictEqual([kokumin2026.m, kokumin2026.d], [9, 22], "2026 国民の休日 should be 9/22");
  const furikae2026 = list2026.filter(h => h.type === "振替休日")[0];
  assert.deepStrictEqual([furikae2026.m, furikae2026.d], [5, 6], "2026 振替休日 should be 5/6");
  // シルバーウィーク2026: 9/21(月,敬老)・9/22(火,国民の休日)・9/23(水,秋分) が連続する
  assert.strictEqual(wdayOf(2026, 9, 21), 1);
  assert.strictEqual(wdayOf(2026, 9, 22), 2);
  assert.strictEqual(wdayOf(2026, 9, 23), 3);

  // 2027年: 祝日16 + 振替休日1(3/22、春分3/21が日曜のため) のみ、国民の休日なし
  assert.strictEqual(list2027.filter(h => h.type === "祝日").length, 16, "2027 祝日 should be 16");
  assert.strictEqual(list2027.filter(h => h.type === "国民の休日").length, 0, "2027 国民の休日 should be 0");
  assert.strictEqual(list2027.filter(h => h.type === "振替休日").length, 1, "2027 振替休日 should be 1");
  assert.strictEqual(list2027.length, 17, "2027 total holidays should be 17");
  assert.deepStrictEqual([byName(list2027, "春分の日").m, byName(list2027, "春分の日").d], [3, 21], "2027 春分");
  assert.deepStrictEqual([byName(list2027, "秋分の日").m, byName(list2027, "秋分の日").d], [9, 23], "2027 秋分");
  assert.deepStrictEqual([byName(list2027, "成人の日").m, byName(list2027, "成人の日").d], [1, 11], "2027 成人の日");
  assert.deepStrictEqual([byName(list2027, "海の日").m, byName(list2027, "海の日").d], [7, 19], "2027 海の日");
  assert.deepStrictEqual([byName(list2027, "敬老の日").m, byName(list2027, "敬老の日").d], [9, 20], "2027 敬老の日");
  assert.deepStrictEqual([byName(list2027, "スポーツの日").m, byName(list2027, "スポーツの日").d], [10, 11], "2027 スポーツの日");
  const furikae2027 = list2027.filter(h => h.type === "振替休日")[0];
  assert.deepStrictEqual([furikae2027.m, furikae2027.d], [3, 22], "2027 振替休日 should be 3/22");

  console.log("shukujitsu.js self-check OK");
  console.log("2026:", list2026.map(h => `${fmt(h)}(${h.name})`).join(" "));
  console.log("2027:", list2027.map(h => `${fmt(h)}(${h.name})`).join(" "));
}
