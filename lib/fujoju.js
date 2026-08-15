"use strict";
// 不成就日（ふじょうじゅび）の計算
// 方式: 旧暦の月+日で決まる8日周期の選日（閏月は元の月番号の表を使う）。
//       旧暦月日は lib/kyureki.js の makeConverter から取得し、ここでは暦計算をしない。
const { makeConverter } = require("./kyureki");

// 旧暦月ごとの不成就日（日）。設計確定済みテーブル。
const FUJOJU_TABLE = {
  1: [3, 11, 19, 27], 7: [3, 11, 19, 27],
  2: [2, 10, 18, 26], 8: [2, 10, 18, 26],
  3: [1, 9, 17, 25], 9: [1, 9, 17, 25],
  4: [4, 12, 20, 28], 10: [4, 12, 20, 28],
  5: [5, 13, 21, 29], 11: [5, 13, 21, 29],
  6: [6, 14, 22, 30], 12: [6, 14, 22, 30],
};

// site6の公開範囲（2026-2027年）をカバーする固定レンジ。build.js の運用範囲と合わせる。
const conv = makeConverter(2025, 2028);

function isFujoju(year, month, day) {
  const c = conv(year, month, day);
  return !!c && FUJOJU_TABLE[c.month].includes(c.day);
}

function listFujoju(year) {
  const result = [];
  for (let m = 1; m <= 12; m++) {
    const last = new Date(Date.UTC(year, m, 0)).getUTCDate();
    for (let d = 1; d <= last; d++) if (isFujoju(year, m, d)) result.push({ month: m, day: d });
  }
  return result;
}

module.exports = { isFujoju, listFujoju, FUJOJU_TABLE };

// ---- 自己検証 ----
if (require.main === module) {
  const assert = require("assert");
  // 内部整合性チェック: isFujoju が true を返した日について、新暦→旧暦変換した月日が
  // FUJOJU_TABLE の8日周期表と一致するかを検証する（外部の公開リストとの照合は別途行う）。
  let checked = 0;
  for (const year of [2026, 2027]) {
    const list = listFujoju(year);
    assert.ok(list.length > 0, `no fujoju days found for ${year}`);
    for (const { month, day } of list) {
      const c = conv(year, month, day);
      assert.ok(c, `no lunar conversion for ${year}-${month}-${day}`);
      assert.ok(FUJOJU_TABLE[c.month].includes(c.day),
        `${year}-${month}-${day} -> lunar ${c.month}/${c.day} not in FUJOJU_TABLE`);
      checked++;
    }
  }
  assert.ok(checked >= 10, `too few fujoju days checked: ${checked}`);
  console.log(`fujoju.js self-check OK (${checked} fujoju days across 2026-2027 matched the 8-day lunar table)`);
}
