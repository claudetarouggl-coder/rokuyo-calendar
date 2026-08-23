"use strict";
// 六曜カレンダー 静的サイトジェネレータ
// 生成物: docs/ 以下に index.html + 月別17ページ + 大安一覧2ページ + ガイド3本 + sitemap.xml + 404.html
const fs = require("fs");
const path = require("path");
const { makeConverter } = require("./lib/kyureki");
const { isIchiryumanbai, isTenshabi } = require("./lib/kanshi");
const { isFujoju } = require("./lib/fujoju");
const { holidaysOf } = require("./lib/shukujitsu");
const { GOODS, MOON_GOODS, SAIKYOBI_GOODS, NENGAJO_GOODS } = require("./lib/affiliates");

const BASE = "https://claudetarouggl-coder.github.io/rokuyo-calendar/";
// 姉妹サイト相互リンク（自サイトは除外）
const RELATED_SITES = [
  ["https://claudetarouggl-coder.github.io/kyou-no-taiyo/", "きょうの太陽"],
  ["https://claudetarouggl-coder.github.io/hinode-calendar/", "日の出・日の入りカレンダー"],
  ["https://claudetarouggl-coder.github.io/furusato-keisan/", "ふるさと納税 上限額計算"],
  ["https://claudetarouggl-coder.github.io/nenrei-hayami/", "年齢早見表"],
  ["https://claudetarouggl-coder.github.io/rokuyo-calendar/", "六曜カレンダー"],
  ["https://claudetarouggl-coder.github.io/tester-match/", "テスターマッチ"],
  ["https://claudetarouggl-coder.github.io/houji-hayami/", "法事・回忌早見表"],
  ["https://claudetarouggl-coder.github.io/pet-nenrei/", "犬・猫の年齢換算"],
  ["https://claudetarouggl-coder.github.io/nemuri-keisan/", "睡眠サイクル計算"],
];
const RELATED_NAV = `<p class="related">姉妹サイト: ${RELATED_SITES.filter(([u]) => u !== BASE)
  .map(([u, n]) => `<a href="${u}" rel="noopener">${n}</a>`).join("・")}</p>`;
const GA_ID = "G-P6NLJ3XZ7R";
const OUT = path.join(__dirname, "docs");

const jstNow = new Date(Date.now() + 540 * 60000);
const TODAY = { y: jstNow.getUTCFullYear(), m: jstNow.getUTCMonth() + 1, d: jstNow.getUTCDate() };
const TODAY_STR = `${TODAY.y}-${String(TODAY.m).padStart(2, "0")}-${String(TODAY.d).padStart(2, "0")}`;

const conv = makeConverter(2025, 2028);
const WDAYS = ["日", "月", "火", "水", "木", "金", "土"];

// 公開範囲: 2026年8月〜2027年12月（17ヶ月）
const MONTHS = [];
for (let y = 2026; y <= 2027; y++) {
  for (let m = 1; m <= 12; m++) {
    if (y === 2026 && m < 8) continue;
    MONTHS.push({ y, m });
  }
}

const pad2 = n => String(n).padStart(2, "0");
const monthPath = (y, m) => `${y}/${pad2(m)}/`;
const ichiryuPath = y => `ichiryumanbai/${y}/`;
const tenshaPath = y => `tensha/${y}/`;
const fujojuPath = y => `fujojubi/${y}/`;
const meigetsuPath = "meigetsu/";
const saikyobiPath = "saikyobi/";
const shukujitsuPath = "shukujitsu/";
const nengajoPath = "nengajo/";
const daysInMonth = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const wdayOf = (y, m, d) => new Date(Date.UTC(y, m - 1, d)).getUTCDay();
const lunarStrOf = c => `旧暦${c.leap ? "閏" : ""}${c.month}月${c.day}日`;

// ---- 中秋の名月（旧暦8/15）・十三夜（旧暦9/13）----
// 出典: 国立天文台 2026年9月の天文現象 https://www.nao.ac.jp/astro/sky/2026/09-topics03.html
// （2026年の朔=9/11 12:27 JST、満月=9/27。名月は朔日起算の旧暦8/15で決まるため2日ずれる）
const MEIGETSU = {
  2026: { y: 2026, m: 9, d: 25 },
  2027: { y: 2027, m: 9, d: 15 },
};
const JUSANYA = {
  2026: { y: 2026, m: 10, d: 23 },
  2027: { y: 2027, m: 10, d: 12 },
};
for (const y of [2026, 2027]) {
  const mg = MEIGETSU[y], c1 = conv(mg.y, mg.m, mg.d);
  if (!(c1.month === 8 && c1.day === 15 && !c1.leap)) throw new Error(`meigetsu anchor mismatch for ${y}: ${JSON.stringify(c1)}`);
  mg.rokuyo = c1.rokuyo; mg.wday = wdayOf(mg.y, mg.m, mg.d);
  const jy = JUSANYA[y], c2 = conv(jy.y, jy.m, jy.d);
  if (!(c2.month === 9 && c2.day === 13 && !c2.leap)) throw new Error(`jusanya anchor mismatch for ${y}: ${JSON.stringify(c2)}`);
  jy.rokuyo = c2.rokuyo; jy.wday = wdayOf(jy.y, jy.m, jy.d);
}

function monthRows(y, m) {
  const last = daysInMonth(y, m);
  const rows = [];
  for (let d = 1; d <= last; d++) {
    const c = conv(y, m, d);
    rows.push({
      d, wday: wdayOf(y, m, d), rokuyo: c.rokuyo, lunarStr: lunarStrOf(c),
      ichiryu: isIchiryumanbai(y, m, d), tensha: isTenshabi(y, m, d), fujoju: isFujoju(y, m, d),
    });
  }
  return rows;
}
const remarkOf = r => [r.tensha ? "天赦" : "", r.ichiryu ? "一粒万倍" : "", r.fujoju ? "不成就" : ""].filter(Boolean).join("・");

const ALL_MONTHS_DATA = MONTHS.map(({ y, m }) => ({ y, m, rows: monthRows(y, m) }));

// 一粒万倍日・天赦日 一覧（年別、月をまたいで全日走査）
const ICHIRYU_BY_YEAR = {};
const TENSHA_BY_YEAR = {};
const FUJOJU_BY_YEAR = {};
const SAIKYOBI_BY_YEAR = {};
for (const y of [2026, 2027]) {
  ICHIRYU_BY_YEAR[y] = [];
  TENSHA_BY_YEAR[y] = [];
  FUJOJU_BY_YEAR[y] = [];
  SAIKYOBI_BY_YEAR[y] = [];
  for (let m = 1; m <= 12; m++) {
    const last = daysInMonth(y, m);
    for (let d = 1; d <= last; d++) {
      const wday = wdayOf(y, m, d);
      const rokuyo = conv(y, m, d).rokuyo;
      const ichiryu = isIchiryumanbai(y, m, d), tensha = isTenshabi(y, m, d), fujoju = isFujoju(y, m, d);
      if (ichiryu) ICHIRYU_BY_YEAR[y].push({ m, d, wday, rokuyo, tensha });
      if (tensha) TENSHA_BY_YEAR[y].push({ m, d, wday, rokuyo, ichiryu });
      if (fujoju) FUJOJU_BY_YEAR[y].push({ m, d, wday, rokuyo, taian: rokuyo === "大安", ichiryu });
      if (tensha && ichiryu) SAIKYOBI_BY_YEAR[y].push({ m, d, wday, rokuyo, fujoju });
    }
  }
}

// 最強開運日（天赦日×一粒万倍日）: 事前検証済みの正解と一致するかを検証する
// 出典: 池田工芸・kaiunya.jp 等複数メディアと2026年分は照合済み
const SAIKYOBI_EXPECTED = {
  2026: [[3, 5], [7, 19], [10, 1], [12, 16]],
  2027: [[7, 14], [9, 26], [12, 11]],
};
for (const y of [2026, 2027]) {
  const got = SAIKYOBI_BY_YEAR[y].map(it => [it.m, it.d]);
  if (JSON.stringify(got) !== JSON.stringify(SAIKYOBI_EXPECTED[y])) {
    throw new Error(`saikyobi mismatch for ${y}: got ${JSON.stringify(got)}, want ${JSON.stringify(SAIKYOBI_EXPECTED[y])}`);
  }
}
const SAIKYOBI_FUJOJU_OVERLAP_EXPECTED = [[2026, 7, 19], [2027, 9, 26]];
const saikyobiFujojuOverlapGot = [];
for (const y of [2026, 2027]) for (const it of SAIKYOBI_BY_YEAR[y]) if (it.fujoju) saikyobiFujojuOverlapGot.push([y, it.m, it.d]);
if (JSON.stringify(saikyobiFujojuOverlapGot) !== JSON.stringify(SAIKYOBI_FUJOJU_OVERLAP_EXPECTED)) {
  throw new Error(`saikyobi fujoju overlap mismatch: got ${JSON.stringify(saikyobiFujojuOverlapGot)}, want ${JSON.stringify(SAIKYOBI_FUJOJU_OVERLAP_EXPECTED)}`);
}

// 月別ページに「この月の最強開運日」マーカーを出すための逆引きマップ
const SAIKYOBI_MONTH_MAP = {};
for (const y of [2026, 2027]) for (const it of SAIKYOBI_BY_YEAR[y]) {
  const key = `${y}-${it.m}`;
  (SAIKYOBI_MONTH_MAP[key] = SAIKYOBI_MONTH_MAP[key] || []).push(it.d);
}

// トップページの「今日の六曜」用: 公開範囲全日の六曜・備考（天赦/一粒万倍/不成就）を持つ軽量マップ
const DAY_MAP = {};
const REMARK_MAP = {};
for (const { y, m, rows } of ALL_MONTHS_DATA) for (const r of rows) {
  const key = `${y}-${m}-${r.d}`;
  DAY_MAP[key] = r.rokuyo;
  const remark = remarkOf(r);
  if (remark) REMARK_MAP[key] = remark;
}

// 祝日・休日一覧（年別、六曜つき）
const SHUKUJITSU_BY_YEAR = {};
for (const y of [2026, 2027]) {
  SHUKUJITSU_BY_YEAR[y] = holidaysOf(y).map(h => ({
    ...h, wday: wdayOf(h.y, h.m, h.d), rokuyo: conv(h.y, h.m, h.d).rokuyo,
  }));
}

// 大安一覧（年別）
const TAIAN_BY_YEAR = {};
for (const { y, m, rows } of ALL_MONTHS_DATA) {
  TAIAN_BY_YEAR[y] = TAIAN_BY_YEAR[y] || [];
  for (const r of rows) if (r.rokuyo === "大安") TAIAN_BY_YEAR[y].push({ y, m, d: r.d, wday: r.wday });
}

// 仏滅・友引一覧（年別）
const BUTSUMETSU_BY_YEAR = {};
const TOMOBIKI_BY_YEAR = {};
for (const { y, m, rows } of ALL_MONTHS_DATA) {
  BUTSUMETSU_BY_YEAR[y] = BUTSUMETSU_BY_YEAR[y] || [];
  TOMOBIKI_BY_YEAR[y] = TOMOBIKI_BY_YEAR[y] || [];
  for (const r of rows) {
    if (r.rokuyo === "仏滅") BUTSUMETSU_BY_YEAR[y].push({ y, m, d: r.d, wday: r.wday });
    if (r.rokuyo === "友引") TOMOBIKI_BY_YEAR[y].push({ y, m, d: r.d, wday: r.wday });
  }
}

const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const emittedUrls = [];
const linkTargets = new Set();
const canonical = p => BASE + p;
function rel(depth, target) {
  linkTargets.add(target);
  return target ? "../".repeat(depth) + target : (depth ? "../".repeat(depth) : "./");
}

const CSS = `
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:"Hiragino Kaku Gothic ProN","Yu Gothic",Meiryo,sans-serif;color:#33281f;background:#fdf8f3;line-height:1.7}
main{max-width:860px;margin:0 auto;padding:1rem}
header.site{background:linear-gradient(135deg,#8f2415,#c0492b);padding:1.2rem 1rem .9rem;text-align:center}
header.site a{color:#fff;text-decoration:none;font-weight:bold;font-size:1.05rem}
h1{font-size:1.35rem;margin:.8rem 0 .3rem}
h2{font-size:1.1rem;margin:1.6rem 0 .5rem;border-left:4px solid #a8321e;padding-left:.5rem}
h3{font-size:.98rem;margin:1rem 0 .3rem}
nav.bc{font-size:.8rem;color:#8a7a6c;margin:.5rem 0}
nav.bc a{color:#a8321e}
.cards,.feature,.faq,.note,.today{background:#fff;border:1px solid #ecdfd0;border-radius:10px;padding:1rem;margin:.8rem 0}
.today{text-align:center}
.today .vl{font-size:1.6rem;font-weight:bold;color:#a8321e}
.today .lb{font-size:.8rem;color:#8a7a6c;margin-top:.3rem}
.tbl{overflow-x:auto;background:#fff;border:1px solid #ecdfd0;border-radius:10px;margin:.8rem 0}
table{border-collapse:collapse;width:100%;font-size:.88rem;white-space:nowrap}
th,td{padding:.4rem .6rem;text-align:center;border-bottom:1px solid #f4ebdf}
th{background:#f6ece0;font-weight:600}
tr.sat td:first-child{color:#2a6bb5}
tr.sun td:first-child{color:#c33}
tr.taian{background:#fff1de}
tr.taian td:nth-child(2){font-weight:bold;color:#a8321e}
.faq dt{font-weight:600;margin-top:.6rem}.faq dd{margin-left:0;color:#5c5145}
.links{display:flex;flex-wrap:wrap;gap:.5rem;margin:.6rem 0}
.links a{background:#fff;border:1px solid #ecdfd0;border-radius:999px;padding:.3rem .8rem;font-size:.85rem;text-decoration:none;color:#a8321e}
a{color:#a8321e}
.goods li{margin:.35rem 0 .35rem 1.2em}
.tlist strong{color:#a8321e}
.tlist ul{margin-left:1.2em}
footer{margin:2rem 0 1rem;color:#8a7a6c;font-size:.75rem;text-align:center;line-height:1.9}
.note{font-size:.88rem;color:#5c5145}
`.trim();

function shell({ path: pagePath, depth, title, desc, h1, breadcrumbs, body, extraHead = "", extraScript = "" }) {
  const canon = canonical(pagePath);
  emittedUrls.push(canon);
  const gtag = GA_ID ? `
<script async src="https://www.googletagmanager.com/gtag/js?id=${GA_ID}"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA_ID}');</script>` : "";
  const bcJson = breadcrumbs.length ? `<script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org", "@type": "BreadcrumbList",
    itemListElement: breadcrumbs.map((b, i) => ({
      "@type": "ListItem", position: i + 1, name: b.name, item: canonical(b.path),
    })),
  })}</script>` : "";
  const bcNav = breadcrumbs.length > 1 ? `<nav class="bc">${breadcrumbs.map((b, i) =>
    i === breadcrumbs.length - 1 ? esc(b.name) : `<a href="${rel(depth, b.path)}">${esc(b.name)}</a>`).join(" › ")}</nav>` : "";
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${canon}">
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>📅</text></svg>">${gtag}
${bcJson}${extraHead}
<style>${CSS}</style>
</head>
<body>
<header class="site"><a href="${rel(depth, "")}">六曜カレンダー</a></header>
<main>
${bcNav}
<h1>${esc(h1)}</h1>
${body}
<footer>
六曜・旧暦は当サイト独自の天文計算によるもので、朔の日付は国立天文台の暦要項（2026年・2027年）と照合済みです。六曜は伝統的な暦注であり科学的根拠はありません。冠婚葬祭の判断は参考程度にご利用ください。
${RELATED_NAV}
</footer>
</main>
${extraScript}
</body>
</html>`;
}

function writePage(relPath, html) {
  const file = path.join(OUT, relPath);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html);
}

const guideLinks = depth => `<h2>あわせて読む</h2><div class="links">
<a href="${rel(depth, "guide/imi/")}">六曜とは？意味と順番</a>
<a href="${rel(depth, "guide/kekkonshiki/")}">仏滅・友引の結婚式はダメ？</a>
<a href="${rel(depth, "guide/tomobiki/")}">友引に葬式を避けるのはなぜ？</a>
<a href="${rel(depth, "guide/ichiryumanbai-imi/")}">一粒万倍日とは？やると良いこと・避けること</a>
<a href="${rel(depth, "fujojubi/")}">不成就日とは？由来と8日周期のルール</a>
<a href="${rel(depth, meigetsuPath)}">中秋の名月はいつ？十五夜・十三夜の日付</a>
<a href="${rel(depth, saikyobiPath)}">最強開運日はいつ？天赦日と一粒万倍日が重なる日</a>
<a href="${rel(depth, shukujitsuPath)}">祝日カレンダー｜振替休日・連休一覧</a>
<a href="${rel(depth, nengajoPath)}">年賀状はいつまで？喪中はがき・寒中見舞いの時期</a></div>`;

const taianLinks = depth => `<div class="links">
<a href="${rel(depth, "taian/2026/")}">2026年の大安一覧</a>
<a href="${rel(depth, "taian/2027/")}">2027年の大安一覧</a></div>`;

const kichijitsuLinks = depth => `<div class="links">
<a href="${rel(depth, "taian/2026/")}">2026年の大安一覧</a>
<a href="${rel(depth, "taian/2027/")}">2027年の大安一覧</a>
<a href="${rel(depth, "butsumetsu/2026/")}">2026年の仏滅一覧</a>
<a href="${rel(depth, "butsumetsu/2027/")}">2027年の仏滅一覧</a>
<a href="${rel(depth, "tomobiki/2026/")}">2026年の友引一覧</a>
<a href="${rel(depth, "tomobiki/2027/")}">2027年の友引一覧</a>
<a href="${rel(depth, ichiryuPath(2026))}">2026年の一粒万倍日一覧</a>
<a href="${rel(depth, ichiryuPath(2027))}">2027年の一粒万倍日一覧</a>
<a href="${rel(depth, tenshaPath(2026))}">2026年の天赦日一覧</a>
<a href="${rel(depth, tenshaPath(2027))}">2027年の天赦日一覧</a>
<a href="${rel(depth, fujojuPath(2026))}">2026年の不成就日一覧</a>
<a href="${rel(depth, fujojuPath(2027))}">2027年の不成就日一覧</a></div>`;

function affiliateBlock(items, headline) {
  const html = items.map(g =>
    `<li><a href="${esc(g.url)}" rel="sponsored noopener" target="_blank">${esc(g.label)}</a> — ${esc(g.note)}</li>`).join("\n");
  return `<section class="note goods"><h2>${esc(headline)}<small>（広告を含みます）</small></h2><ul>${html}</ul></section>`;
}

// ---- 月別ページ ----
function buildMonthPage(idx) {
  const { y, m, rows } = ALL_MONTHS_DATA[idx];
  const taianDays = rows.filter(r => r.rokuyo === "大安").map(r => r.d);
  const weekendTaian = rows.filter(r => r.rokuyo === "大安" && (r.wday === 0 || r.wday === 6));
  const butsumetsuDays = rows.filter(r => r.rokuyo === "仏滅").map(r => r.d);

  const introText = `この月の大安は${taianDays.map(d => `${d}日`).join("・")}です`
    + `（うち土日は${weekendTaian.length ? weekendTaian.map(r => `${r.d}日(${WDAYS[r.wday]})`).join("・") : "ありません"}）。`
    + `仏滅は${butsumetsuDays.map(d => `${d}日`).join("・")}です。`;

  const tableRows = rows.map(r => {
    const cls = [r.wday === 6 ? "sat" : r.wday === 0 ? "sun" : "", r.rokuyo === "大安" ? "taian" : ""]
      .filter(Boolean).join(" ");
    return `<tr class="${cls}"><td>${r.d}日(${WDAYS[r.wday]})</td><td>${esc(r.rokuyo)}</td><td>${esc(r.lunarStr)}</td><td>${esc(remarkOf(r))}</td></tr>`;
  }).join("\n");

  const isMeigetsuMonth = (y === 2026 || y === 2027) && (m === 9 || m === 10);
  const meigetsuNote = isMeigetsuMonth
    ? `<p class="note"><a href="${rel(2, meigetsuPath)}">${y}年の中秋の名月・十三夜はいつ？</a>もあわせてご覧ください。</p>`
    : "";

  const saikyobiDays = SAIKYOBI_MONTH_MAP[`${y}-${m}`];
  const saikyobiNote = saikyobiDays
    ? `<p class="note">この月の${saikyobiDays.map(d => `${d}日`).join("・")}は天赦日と一粒万倍日が重なる<a href="${rel(2, saikyobiPath)}">最強開運日</a>です。</p>`
    : "";

  const prevM = idx > 0 ? ALL_MONTHS_DATA[idx - 1] : null;
  const nextM = idx < ALL_MONTHS_DATA.length - 1 ? ALL_MONTHS_DATA[idx + 1] : null;
  const prevNav = prevM ? `<a href="${rel(2, monthPath(prevM.y, prevM.m))}">← ${prevM.y}年${prevM.m}月</a>` : "<span></span>";
  const nextNav = nextM ? `<a href="${rel(2, monthPath(nextM.y, nextM.m))}">${nextM.y}年${nextM.m}月 →</a>` : "<span></span>";

  const body = `
<section class="feature"><p>${introText}</p></section>
<div class="tbl"><table>
<thead><tr><th>日付(曜日)</th><th>六曜</th><th>旧暦</th><th>備考</th></tr></thead>
<tbody>${tableRows}</tbody></table></div>
<p class="note">備考の「天赦」は<a href="${rel(2, tenshaPath(y))}">天赦日</a>、「一粒万倍」は<a href="${rel(2, ichiryuPath(y))}">一粒万倍日</a>、「不成就」は<a href="${rel(2, fujojuPath(y))}">不成就日</a>を示します（複数該当する日もあります）。</p>
${meigetsuNote}
${saikyobiNote}
<div style="display:flex;justify-content:space-between;margin:1rem 0">${prevNav}${nextNav}</div>
<section class="faq"><h2>よくある質問</h2><dl>
<dt>${m}月の大安はいつ？</dt><dd>${y}年${m}月の大安は${taianDays.map(d => `${d}日`).join("・")}です。</dd>
<dt>${m}月の土日の大安は？</dt><dd>${weekendTaian.length ? `${weekendTaian.map(r => `${r.d}日(${WDAYS[r.wday]})`).join("・")}です。` : `${y}年${m}月に土日の大安はありません。`}</dd>
<dt>六曜はどうやって決まる？</dt><dd>旧暦の月と日を足した数を6で割った余りで機械的に決まります。詳しくは<a href="${rel(2, "guide/imi/")}">六曜とは？意味と順番</a>をご覧ください。</dd>
</dl></section>
<h2>大安の日取りを年間でチェック</h2>
${taianLinks(2)}
${guideLinks(2)}`;

  writePage(`${monthPath(y, m)}index.html`, shell({
    path: monthPath(y, m), depth: 2,
    title: `${y}年${m}月の六曜カレンダー｜大安・仏滅・友引が一目でわかる`,
    desc: `${y}年${m}月の六曜（大安・友引・先勝・先負・仏滅・赤口）を日別に一覧掲載。${introText}`,
    h1: `${y}年${m}月の六曜カレンダー`,
    breadcrumbs: [{ name: "六曜カレンダー", path: "" }, { name: `${y}年${m}月`, path: monthPath(y, m) }],
    body,
  }));
}

// ---- 大安一覧ページ ----
function buildTaianPage(y) {
  const list = TAIAN_BY_YEAR[y];
  const byMonth = {};
  for (const it of list) (byMonth[it.m] = byMonth[it.m] || []).push(it);

  const rangeNote = y === 2026
    ? `2026年8月〜12月の大安一覧です。`
    : `2027年の大安一覧です。`;

  const sections = Object.keys(byMonth).map(m => {
    const items = byMonth[m].map(it => {
      const label = `${it.d}日（${WDAYS[it.wday]}）`;
      return it.wday === 0 || it.wday === 6 ? `<li><strong>${label}</strong></li>` : `<li>${label}</li>`;
    }).join("\n");
    return `<h3>${m}月</h3><ul>${items}</ul>`;
  }).join("\n");

  const body = `
<section class="feature"><p>${rangeNote}大安は六曜で最も吉とされる日で、結婚式・入籍・納車・引っ越しの日取りに人気です。土日の大安は太字で示しています。</p></section>
<div class="tlist">${sections}</div>
${affiliateBlock(GOODS, "大安の日取りにあわせて選びたいギフト・縁起物")}
<section class="faq"><h2>よくある質問</h2><dl>
<dt>大安は月に何回ある？</dt><dd>六曜は旧暦の月と日の和を6で割った余りで機械的に決まるため月によって回数は変わりますが、おおむね5回前後になります。</dd>
<dt>大安と天赦日はどちらが良い？</dt><dd>天赦日は六曜とは別の暦注（暦の吉日を示す仕組み）です。体系が異なるため、どちらが上ということはなく、どちらも吉日とされています。</dd>
<dt>仏滅に入籍してはいけない？</dt><dd>六曜は伝統的な迷信の一種とされ、気にしない方も多いです。詳しくは<a href="${rel(2, "guide/kekkonshiki/")}">仏滅・友引の結婚式はダメ？</a>をご覧ください。</dd>
</dl></section>
${guideLinks(2)}`;

  writePage(`taian/${y}/index.html`, shell({
    path: `taian/${y}/`, depth: 2,
    title: `${y}年の大安一覧｜結婚式・入籍・納車・引っ越しの日取りに`,
    desc: `${rangeNote}結婚式・入籍・納車・引っ越しの日取りに人気の大安の日付を月別に一覧掲載。土日の大安もひと目でわかります。`,
    h1: `${y}年の大安一覧`,
    breadcrumbs: [{ name: "六曜カレンダー", path: "" }, { name: `${y}年の大安一覧`, path: `taian/${y}/` }],
    body,
  }));
}

// ---- 仏滅・友引一覧ページ ----
function monthListSections(list) {
  const byMonth = {};
  for (const it of list) (byMonth[it.m] = byMonth[it.m] || []).push(it);
  return Object.keys(byMonth).map(m => {
    const items = byMonth[m].map(it => {
      const label = `${it.d}日（${WDAYS[it.wday]}）`;
      return it.wday === 0 || it.wday === 6 ? `<li><strong>${label}</strong></li>` : `<li>${label}</li>`;
    }).join("\n");
    return `<h3>${m}月</h3><ul>${items}</ul>`;
  }).join("\n");
}

function buildButsumetsuPage(y) {
  const rangeNote = y === 2026 ? `2026年8月〜12月の仏滅一覧です。` : `2027年の仏滅一覧です。`;
  const body = `
<section class="feature"><p>${rangeNote}仏滅は六曜で「万事に凶」とされ、結婚式・入籍などの日取りでは避けられることが多い日です。一方で、もとは「物滅」と書き「物事がいったん終わり、新しく始まる日」とする解釈もあります。土日は太字で示しています。</p></section>
<div class="tlist">${monthListSections(BUTSUMETSU_BY_YEAR[y])}</div>
<section class="faq"><h2>よくある質問</h2><dl>
<dt>仏滅に入籍・結婚式をしてはいけない？</dt><dd>六曜は伝統的な暦注で科学的根拠はなく、仏教とも直接の関係はないとされています。気にするかどうかは考え方次第です。詳しくは<a href="${rel(2, "guide/kekkonshiki/")}">仏滅・友引の結婚式はダメ？</a>をご覧ください。</dd>
<dt>仏滅の引っ越し・納車は避けるべき？</dt><dd>根拠のある吉凶ではありませんが、周囲の意向が気になる場合は<a href="${rel(2, `taian/${y}/`)}">大安</a>など別の日を選ぶ方法もあります。逆に、式場や引っ越しの料金プランが仏滅は割安になる場合があり、あえて選ぶ方もいます。</dd>
<dt>仏滅は月に何回ある？</dt><dd>六曜は旧暦の月と日の和を6で割った余りで機械的に決まるため月により変わりますが、おおむね5回前後です。</dd>
</dl></section>
${guideLinks(2)}`;
  writePage(`butsumetsu/${y}/index.html`, shell({
    path: `butsumetsu/${y}/`, depth: 2,
    title: `${y}年の仏滅一覧｜結婚式・入籍・引っ越しで避けたい日をチェック`,
    desc: `${rangeNote}結婚式・入籍・引っ越しの日取り選びで確認したい仏滅の日付を月別に一覧掲載。土日の仏滅もひと目でわかります。`,
    h1: `${y}年の仏滅一覧`,
    breadcrumbs: [{ name: "六曜カレンダー", path: "" }, { name: `${y}年の仏滅一覧`, path: `butsumetsu/${y}/` }],
    body,
  }));
}

function buildTomobikiPage(y) {
  const rangeNote = y === 2026 ? `2026年8月〜12月の友引一覧です。` : `2027年の友引一覧です。`;
  const body = `
<section class="feature"><p>${rangeNote}友引は「友を引く」という語呂から葬儀を避ける習わしがある日で、友引を休業日とする火葬場も多くあります。一方、結婚式などの慶事では「幸せのお裾分け」として吉日とされます。土日は太字で示しています。</p></section>
<div class="tlist">${monthListSections(TOMOBIKI_BY_YEAR[y])}</div>
<section class="faq"><h2>よくある質問</h2><dl>
<dt>友引に葬式をしてはいけない？</dt><dd>宗教上の禁忌ではなく語呂にもとづく俗信とされていますが、参列者への配慮や火葬場の休業により、実務上は友引を避けて日程を組むことが多いです。詳しくは<a href="${rel(2, "guide/tomobiki/")}">友引に葬式を避けるのはなぜ？</a>をご覧ください。</dd>
<dt>友引に通夜はできる？</dt><dd>通夜は友引でも行われることが多いとされています。地域や斎場の慣習にもよるため、葬儀社にご確認ください。</dd>
<dt>友引の結婚式・入籍は？</dt><dd>慶事では「幸せを友に引き分ける」とされ、大安に次ぐ吉日として人気があります。ただし午の刻（昼前後）は凶とする説もあります。</dd>
</dl></section>
${guideLinks(2)}`;
  writePage(`tomobiki/${y}/index.html`, shell({
    path: `tomobiki/${y}/`, depth: 2,
    title: `${y}年の友引一覧｜葬儀・葬式の日取り確認に`,
    desc: `${rangeNote}葬儀の日程調整や結婚式の日取り選びで確認したい友引の日付を月別に一覧掲載。土日の友引もひと目でわかります。`,
    h1: `${y}年の友引一覧`,
    breadcrumbs: [{ name: "六曜カレンダー", path: "" }, { name: `${y}年の友引一覧`, path: `tomobiki/${y}/` }],
    body,
  }));
}

// ---- 一粒万倍日一覧ページ ----
function buildIchiryuPage(y) {
  const list = ICHIRYU_BY_YEAR[y].filter(it => y !== 2026 || it.m >= 8);
  const byMonth = {};
  for (const it of list) (byMonth[it.m] = byMonth[it.m] || []).push(it);

  const rangeNote = y === 2026
    ? `2026年8月〜12月の一粒万倍日一覧です（当サイトの公開範囲にあわせています）。`
    : `2027年の一粒万倍日一覧です。`;

  const overlaps = list.filter(it => it.rokuyo === "大安" || it.tensha);
  const overlapText = overlaps.length
    ? `このうち${overlaps.map(it => `${it.m}月${it.d}日`).join("・")}は大安または天赦日と重なる「重なる日」で、特に縁起が良いとされています。`
    : `この期間に大安・天赦日と重なる日はありません。`;

  const sections = Object.keys(byMonth).map(m => {
    const items = byMonth[m].map(it => {
      const tags = [it.rokuyo === "大安" ? "大安" : "", it.tensha ? "天赦日" : ""].filter(Boolean);
      const label = `${it.d}日（${WDAYS[it.wday]}）${esc(it.rokuyo)}${tags.length ? `・${tags.join("×")}と重なる日` : ""}`;
      return it.wday === 0 || it.wday === 6 ? `<li><strong>${label}</strong></li>` : `<li>${label}</li>`;
    }).join("\n");
    return `<h3>${m}月</h3><ul>${items}</ul>`;
  }).join("\n");

  const body = `
<section class="feature"><p>一粒万倍日（いちりゅうまんばいび）は「一粒の籾（もみ）が万倍の稲穂になる」ことに由来するとされる吉日で、節切りの月（立春を起点とする節月）ごとに定められた十二支の日に巡ってくるとされています。何かを始める日として縁起が良いとされる一方、借り物や人から借りたお金の返済は「万倍に増えて返ってくる」として避けたほうがよいとされています。${rangeNote}${overlapText}土日は太字で示しています。</p></section>
<div class="tlist">${sections}</div>
${affiliateBlock(GOODS, "一粒万倍日の日取りにあわせて選びたいギフト・縁起物")}
<section class="faq"><h2>よくある質問</h2><dl>
<dt>一粒万倍日とは？</dt><dd>「一粒の籾が万倍の稲穂に実る」ことにちなむ吉日で、何かを始めるのに良い日とされています。</dd>
<dt>一粒万倍日は月に何回ある？</dt><dd>節切りの月ごとに十二支2つが割り当てられているため、月によって回数は変わりますが、おおむね4〜7回程度巡ってくるとされています。</dd>
<dt>大安や天赦日と重なる日は？</dt><dd>${overlapText}</dd>
</dl></section>
<h2>あわせてチェック</h2>
${kichijitsuLinks(2)}
${guideLinks(2)}`;

  writePage(`${ichiryuPath(y)}index.html`, shell({
    path: ichiryuPath(y), depth: 2,
    title: `一粒万倍日 ${y}年の一覧カレンダー｜大安と重なる日も`,
    desc: `${rangeNote}一粒万倍日の日付を月別に一覧掲載。大安・天赦日と重なる「重なる日」もあわせて確認できます。`,
    h1: `一粒万倍日 ${y}年の一覧カレンダー`,
    breadcrumbs: [{ name: "六曜カレンダー", path: "" }, { name: `一粒万倍日 ${y}年`, path: ichiryuPath(y) }],
    body,
  }));
}

// ---- 天赦日一覧ページ ----
function buildTenshaPage(y) {
  const list = TENSHA_BY_YEAR[y].filter(it => y !== 2026 || it.m >= 8);

  const rangeNote = y === 2026
    ? `2026年8月〜12月の天赦日一覧です（当サイトの公開範囲にあわせています）。`
    : `2027年の天赦日一覧です。`;

  const overlaps = list.filter(it => it.rokuyo === "大安" || it.ichiryu);
  const overlapText = overlaps.length
    ? `このうち${overlaps.map(it => `${it.m}月${it.d}日`).join("・")}は大安または一粒万倍日と重なる「重なる日」で、特に縁起が良いとされています。`
    : `この期間に大安・一粒万倍日と重なる日はありません。`;

  const items = list.map(it => {
    const tags = [it.rokuyo === "大安" ? "大安" : "", it.ichiryu ? "一粒万倍日" : ""].filter(Boolean);
    const label = `${it.m}月${it.d}日（${WDAYS[it.wday]}）${esc(it.rokuyo)}${tags.length ? `・${tags.join("×")}と重なる日` : ""}`;
    return it.wday === 0 || it.wday === 6 ? `<li><strong>${label}</strong></li>` : `<li>${label}</li>`;
  }).join("\n");

  const body = `
<section class="feature"><p>天赦日（てんしゃにち）は「天が万物の罪を赦す日」に由来するとされる、暦の中でも最上の吉日とされています。節切りの季節ごとに、立春〜立夏前日は戊寅（つちのえとら）、立夏〜立秋前日は甲午（きのえうま）、立秋〜立冬前日は戊申（つちのえさる）、立冬〜立春前日は甲子（きのえね）の日が天赦日にあたるとされ、年に5〜6回ほど巡ってきます。${rangeNote}${overlapText}土日は太字で示しています。</p></section>
<div class="tlist"><ul>${items}</ul></div>
${affiliateBlock(GOODS, "天赦日の日取りにあわせて選びたいギフト・縁起物")}
<section class="faq"><h2>よくある質問</h2><dl>
<dt>天赦日とは？</dt><dd>季節ごとに定められた干支の日で、暦の吉日の中でも最上のものとされています。</dd>
<dt>天赦日は年に何回ある？</dt><dd>年によって異なりますが、5〜6回程度巡ってくるとされています。</dd>
<dt>一粒万倍日や大安と重なる日は？</dt><dd>${overlapText}</dd>
</dl></section>
<h2>あわせてチェック</h2>
${kichijitsuLinks(2)}
${guideLinks(2)}`;

  writePage(`${tenshaPath(y)}index.html`, shell({
    path: tenshaPath(y), depth: 2,
    title: `天赦日 ${y}年はいつ？一覧と六曜`,
    desc: `${rangeNote}天赦日の日付を六曜つきで一覧掲載。大安・一粒万倍日と重なる「重なる日」もあわせて確認できます。`,
    h1: `天赦日 ${y}年はいつ？`,
    breadcrumbs: [{ name: "六曜カレンダー", path: "" }, { name: `天赦日 ${y}年`, path: tenshaPath(y) }],
    body,
  }));
}

// ---- 不成就日一覧ページ ----
function buildFujojuPage(y) {
  const list = FUJOJU_BY_YEAR[y].filter(it => y !== 2026 || it.m >= 8);
  const byMonth = {};
  for (const it of list) (byMonth[it.m] = byMonth[it.m] || []).push(it);

  const rangeNote = y === 2026
    ? `2026年8月〜12月の不成就日一覧です（当サイトの公開範囲にあわせています）。`
    : `2027年の不成就日一覧です。`;

  const overlaps = list.filter(it => it.taian || it.ichiryu);
  const overlapText = overlaps.length
    ? `このうち${overlaps.map(it => `${it.m}月${it.d}日`).join("・")}は大安または一粒万倍日と同じ日にあたります。不成就日と吉日が重なった場合にどちらを優先するかは考え方次第とされ、諸説あります。`
    : `この期間に大安・一粒万倍日と重なる日はありません。`;

  const sections = Object.keys(byMonth).map(m => {
    const items = byMonth[m].map(it => {
      // 大安は六曜欄にすでに表示されるため、タグでは一粒万倍日の重なりのみ補足する
      const label = `${it.d}日（${WDAYS[it.wday]}）${esc(it.rokuyo)}${it.ichiryu ? "・一粒万倍日と同日" : ""}`;
      return it.wday === 0 || it.wday === 6 ? `<li><strong>${label}</strong></li>` : `<li>${label}</li>`;
    }).join("\n");
    return `<h3>${m}月</h3><ul>${items}</ul>`;
  }).join("\n");

  const body = `
<section class="feature"><p>不成就日（ふじょうじゅび）は「何事も成就しない日」とされる<a href="${rel(2, "fujojubi/")}">選日</a>（暦の吉凶を占う仕組みの一つ）で、結婚・開店・契約など新しく何かを始めるのには向かないとされています。旧暦の月と日から機械的に決まり、8日周期で月に4〜5回ほど巡ってくるとされています。${rangeNote}${overlapText}土日は太字で示しています。</p></section>
<div class="tlist">${sections}</div>
${affiliateBlock(GOODS, "日取りに関わらず選びたいギフト・縁起物")}
<section class="faq"><h2>よくある質問</h2><dl>
<dt>不成就日とは？</dt><dd>「何事も成就しない日」とされる選日で、新しく何かを始めるのには向かないとされる暦注の一つです。詳しくは<a href="${rel(2, "fujojubi/")}">不成就日とは？由来と8日周期のルール</a>をご覧ください。</dd>
<dt>不成就日は月に何回ある？</dt><dd>旧暦の月ごとに割り当てられた8日周期で巡ってくるため、月によって回数は変わりますが、おおむね4〜5回程度とされています。</dd>
<dt>大安と重なったらどうする？</dt><dd>大安や一粒万倍日と不成就日が同じ日になることもあります。どちらを優先するかは考え方次第で、諸説あり気にしない方も多いとされています。</dd>
</dl></section>
<h2>あわせてチェック</h2>
${kichijitsuLinks(2)}
<div class="links"><a href="${rel(2, "")}">月別カレンダーを見る</a></div>
${guideLinks(2)}`;

  writePage(`${fujojuPath(y)}index.html`, shell({
    path: fujojuPath(y), depth: 2,
    title: `不成就日 ${y}年の一覧カレンダー｜大安と重なる日も`,
    desc: `${rangeNote}不成就日の日付を月別に一覧掲載。大安・一粒万倍日と重なる日もあわせて確認できます。`,
    h1: `不成就日 ${y}年の一覧カレンダー`,
    breadcrumbs: [{ name: "六曜カレンダー", path: "" }, { name: `不成就日 ${y}年`, path: fujojuPath(y) }],
    body,
  }));
}

// ---- 不成就日 解説ページ ----
function buildFujojuGuide() {
  const body = `
<section class="feature"><p>不成就日（ふじょうじゅび）は、選日（暦注の一種で、干支や五行などの体系とは別のルールで日の吉凶を占う仕組み）の一つとされています。婚礼・開店・契約など、新しく何かを始めるのには向かない日とされる一方、物事をやめる・区切りをつける用事には向くともいわれます。他の暦注と同様、科学的な根拠はないとされています。</p></section>
<h2>由来</h2>
<p>不成就日の由来ははっきりしないとされていますが、選日の一つとして古くから暦に記載されてきたとされています。「事が成就しない日」という字義のとおり、願いごとや新しい物事の始まりには不向きとされ、婚礼・開業・移転・契約など「事を起こす」場面で避けられることが多いといわれています。</p>
<h2>8日周期のルール</h2>
<p>不成就日は旧暦の月ごとに定められた8日周期で巡ってくるとされています。旧暦1月・7月は3・11・19・27日、2月・8月は2・10・18・26日、3月・9月は1・9・17・25日、4月・10月は4・12・20・28日、5月・11月は5・13・21・29日、6月・12月は6・14・22・30日が不成就日にあたるとされ、閏月は元の月と同じ日にちが使われます。月に4〜5回ほど巡ってくる計算になります。</p>
<h2>一粒万倍日・天赦日と重なった場合</h2>
<p>一粒万倍日や天赦日など「何かを始めるのに良い」とされる吉日と、不成就日が同じ日に重なることがあります。この場合、一般的には不成就日の「成就しない」という性質が優先され、吉日の効果が打ち消されるとされています。ただし、この解釈には諸説あり、必ずしも凶に転じるわけではないと考える立場もあります。気になる場合は日付をずらすなど、無理のない範囲で参考にするとよいとされています。</p>
<h2>不成就日の日取りを確認する</h2>
${kichijitsuLinks(1)}
${guideLinks(1)}`;

  writePage("fujojubi/index.html", shell({
    path: "fujojubi/", depth: 1,
    title: "不成就日とは？意味・由来と8日周期のルール",
    desc: "不成就日（ふじょうじゅび）とは何かを解説。選日の一つとされる由来、旧暦の月ごとに決まる8日周期のルール、一粒万倍日・天赦日と重なった場合の一般的な解釈を紹介します。",
    h1: "不成就日とは？",
    breadcrumbs: [{ name: "六曜カレンダー", path: "" }, { name: "不成就日とは", path: "fujojubi/" }],
    body,
  }));
}

// ---- 中秋の名月・お月見ページ ----
function buildMeigetsuGuide() {
  const fmt = it => `${it.m}月${it.d}日(${WDAYS[it.wday]})`;
  const yearSection = y => {
    const mg = MEIGETSU[y], jy = JUSANYA[y];
    return `
<h2>${y}年の中秋の名月・十三夜</h2>
<div class="tbl"><table><thead><tr><th></th><th>日付</th><th>旧暦</th><th>六曜</th></tr></thead><tbody>
<tr><td>中秋の名月（十五夜）</td><td>${fmt(mg)}</td><td>旧暦8月15日</td><td>${esc(mg.rokuyo)}</td></tr>
<tr><td>十三夜（後の月）</td><td>${fmt(jy)}</td><td>旧暦9月13日</td><td>${esc(jy.rokuyo)}</td></tr>
</tbody></table></div>
<p>日別の六曜は<a href="${rel(1, monthPath(y, 9))}">${y}年9月のカレンダー</a>・<a href="${rel(1, monthPath(y, 10))}">${y}年10月のカレンダー</a>でご確認いただけます。</p>`;
  };

  const body = `
<section class="feature"><p>2026年の中秋の名月（十五夜）は<strong>${fmt(MEIGETSU[2026])}</strong>、十三夜は<strong>${fmt(JUSANYA[2026])}</strong>です。2027年は中秋の名月が${fmt(MEIGETSU[2027])}、十三夜が${fmt(JUSANYA[2027])}です。いずれも旧暦（太陰太陽暦）の8月15日・9月13日にあたる日で、当サイトの独自計算エンジンで算出しています。</p></section>
${yearSection(2026)}
${yearSection(2027)}
<h2>中秋の名月とは？「仲秋」との違い</h2>
<p>中秋の名月は、旧暦8月15日の夜に見える月を指し、「十五夜」とも呼ばれます。旧暦では7〜9月を秋とし、その真ん中にあたる8月を「仲秋」と呼ぶことから「仲秋の名月」と書かれることもありますが、8月15日という特定の1日を指す場合は「中秋の名月」、8月全体を指す場合は「仲秋」と使い分けるのが本来の表記とされています。</p>
<h2>2026年は「名月」と「満月」が2日ずれる</h2>
<p>2026年は、中秋の名月（9月25日）と実際の満月（9月27日）の日付が2日ずれます。中秋の名月は、朔（新月）の瞬間を含む日を旧暦8月の1日として数え、その15日目にあたる日として機械的に決まるのに対し、満月は月・地球・太陽の位置関係から独立に決まるためです。2026年9月の朔は9月11日12時27分ごろで、そこから数えた旧暦8月15日は9月25日になりますが、実際に月が最も丸く見える瞬間は9月27日ごろに訪れます。名月と満月が同じ日にならないのは珍しいことではなく、年によって1〜2日前後します。詳しくは<a href="https://www.nao.ac.jp/astro/sky/2026/09-topics03.html" target="_blank" rel="noopener">国立天文台の解説</a>をご覧ください。</p>
<h2>十三夜と「片見月」</h2>
<p>十三夜は「後の月」とも呼ばれ、中秋の名月から約1か月後の旧暦9月13日に行うお月見で、日本独自の風習とされています。中秋の名月と十三夜のどちらか一方しか月見をしないことを「片見月」と呼び、縁起が良くないとされています。必ず両方行わなければならない決まりではありませんが、気になる方は2つの日をあわせてカレンダーに入れておくとよいでしょう。</p>
<h2>お月見に用意するもの</h2>
<p>月見団子は満月に見立てた丸い団子で、十五夜には15個（または5個）を三方（さんぽう、お供え用の台）にピラミッド状に積んで供えるのが一般的とされています。すすきは稲穂に見立てた魔除けの意味があるとされ、5本前後を束ねて花瓶などに飾ります。里芋や栗、季節の果物をあわせて供える地域もあり、決まった作法があるわけではないため、無理のない範囲で用意すれば十分とされています。</p>
${affiliateBlock(MOON_GOODS, "お月見に揃えたい月見団子・すすき・お供え台")}
<section class="faq"><h2>よくある質問</h2><dl>
<dt>中秋の名月は満月と同じ日ですか？</dt><dd>同じ日になる年もありますが、旧暦の数え方と天文学的な満月の瞬間は別々に決まるため、2026年のように1〜2日ずれる年もあります。</dd>
<dt>十三夜だけ行ってもいい？</dt><dd>片見月は縁起が良くないとされていますが、必ず両方行わなければならない決まりではありません。都合に合わせて無理のない範囲で楽しむとよいとされています。</dd>
<dt>中秋の名月と十三夜、どちらが重要？</dt><dd>どちらも大切なお月見の行事とされていますが、中秋の名月（十五夜）の方がより広く親しまれています。</dd>
</dl></section>
<h2>あわせてチェック</h2>
${kichijitsuLinks(1)}
${guideLinks(1)}`;

  writePage(`${meigetsuPath}index.html`, shell({
    path: meigetsuPath, depth: 1,
    title: "中秋の名月はいつ？【2026年・2027年】十五夜・十三夜の日付と月見カレンダー",
    desc: `中秋の名月は2026年9月25日(金)、十三夜は10月23日(金)。2027年は9月15日・10月12日。旧暦から計算した日付と六曜、名月と満月が2日ずれる理由、お月見の準備をわかりやすく解説します。`,
    h1: "中秋の名月はいつ？十五夜・十三夜の日付と月見カレンダー",
    breadcrumbs: [{ name: "六曜カレンダー", path: "" }, { name: "中秋の名月はいつ？", path: meigetsuPath }],
    body,
  }));
}

// ---- 最強開運日（天赦日×一粒万倍日）ページ ----
function buildSaikyobiGuide() {
  const fmt = it => `${it.m}月${it.d}日(${WDAYS[it.wday]})`;
  const monthPublished = (y, m) => MONTHS.some(mo => mo.y === y && mo.m === m);
  const yearTable = y => {
    const list = SAIKYOBI_BY_YEAR[y];
    const rows = list.map(it => {
      const remark = it.fujoju ? `<strong>⚠不成就日と重複</strong>` : "";
      const dateCell = monthPublished(y, it.m) ? `<a href="${rel(1, monthPath(y, it.m))}">${fmt(it)}</a>` : fmt(it);
      return `<tr><td>${dateCell}</td><td>${esc(it.rokuyo)}</td><td>${remark}</td></tr>`;
    }).join("\n");
    return `<h2>${y}年の最強開運日</h2><div class="tbl"><table><thead><tr><th>日付</th><th>六曜</th><th>備考</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  };

  const list2026 = SAIKYOBI_BY_YEAR[2026], list2027 = SAIKYOBI_BY_YEAR[2027];
  const introDates = `2026年は${list2026.map(fmt).join("・")}の${list2026.length}日、2027年は${list2027.map(fmt).join("・")}の${list2027.length}日`;

  const body = `
<section class="feature"><p>「最強開運日」と呼ばれる、暦の中でも最上の吉日とされる<a href="${rel(1, tenshaPath(2026))}">天赦日</a>と、始めたことが大きく育つとされる一粒万倍日が同じ日に重なるのは、${introDates}です。当サイトの独自計算エンジンで、2026年・2027年の全日を走査して算出しています。</p></section>
${yearTable(2026)}
${yearTable(2027)}
<h2>天赦日とは</h2>
<p>天赦日（てんしゃにち）は「天が万物の罪を赦す日」に由来するとされる、暦の中でも最上の吉日とされています。季節ごとに定められた干支の日にあたり、年に5〜6回ほどしか巡ってきません。詳しい仕組みは<a href="${rel(1, tenshaPath(2026))}">天赦日 2026年の一覧</a>・<a href="${rel(1, tenshaPath(2027))}">2027年の一覧</a>で解説しています。</p>
<h2>一粒万倍日とは</h2>
<p>一粒万倍日（いちりゅうまんばいび）は「一粒の籾が万倍の稲穂に実る」ことに由来するとされる吉日で、何かを始めるのに良い日とされています。節切りの月ごとに巡ってくるため、天赦日より頻度が高く、月に4〜7回ほどあります。やると良いこと・避けることの詳細は<a href="${rel(1, "guide/ichiryumanbai-imi/")}">一粒万倍日とは？やると良いこと・避けること</a>をご覧ください。</p>
<p>この2つの吉日はそれぞれ別の体系で決まるため重なる日は限られており、両方の意味を併せ持つ日として「最強開運日」と呼ばれることがあります。</p>
<h2>不成就日と重なる日はどうする？</h2>
<p>2026年7月19日と2027年9月26日は、天赦日・一粒万倍日に加えて<a href="${rel(1, "fujojubi/")}">不成就日</a>（何事も成就しないとされる選日）にもあたります。不成就日と吉日が同じ日に重なった場合の考え方には諸説あり、「不成就日の性質が優先され、吉日の効果が打ち消されるとして避ける」という説と、「天赦日は暦の中でも最上位の吉日なので気にしなくてよい」という説の両方があるとされています。どちらが正しいという明確な決まりはないため、気になる方は日付をずらすなど、無理のない範囲で参考にするとよいでしょう。</p>
<h2>最強開運日にやると良いとされること</h2>
<ul>
<li><strong>財布の新調・使い始め</strong> — 天赦日・一粒万倍日それぞれで人気の縁起担ぎが重なるため、財布の使い始めに選ぶ人が多いとされています。</li>
<li><strong>開業・開店</strong> — 始めた事業が大きく育つことを願って、開業日に選ぶ人が多いとされています。</li>
<li><strong>宝くじの購入</strong> — 当選金が万倍に増えることを願って、購入日に選ぶ人が多いとされています。</li>
<li><strong>入籍</strong> — 二人の門出にふさわしい日として選ばれることが多いとされています。</li>
</ul>
<p class="note">六曜・天赦日・一粒万倍日はいずれも伝統的な暦注であり、科学的な根拠はありません。日取りの参考程度にご利用ください。</p>
${affiliateBlock(SAIKYOBI_GOODS, "最強開運日に揃えたい開運グッズ")}
<section class="faq"><h2>よくある質問</h2><dl>
<dt>最強開運日とは？</dt><dd>暦の中でも最上の吉日とされる天赦日と、一粒万倍日が同じ日に重なる日のことです。年に数回しかない珍しい重なりです。</dd>
<dt>不成就日と重なった日は避けるべき？</dt><dd>不成就日の効果が優先されるとして避ける説と、天赦日が最上位なので気にしなくてよいとする説の両方があり、明確な決まりはありません。</dd>
<dt>次の最強開運日はいつ？</dt><dd>2026年は3月5日・7月19日・10月1日・12月16日、2027年は7月14日・9月26日・12月11日です。</dd>
</dl></section>
<h2>あわせてチェック</h2>
${kichijitsuLinks(1)}
${guideLinks(1)}`;

  writePage(`${saikyobiPath}index.html`, shell({
    path: saikyobiPath, depth: 1,
    title: "最強開運日はいつ？【2026年・2027年】天赦日と一粒万倍日が重なる日",
    desc: `最強開運日（天赦日×一粒万倍日）は2026年3月5日・7月19日・10月1日・12月16日、2027年7月14日・9月26日・12月11日。不成就日と重なる日の考え方、やると良いとされることをわかりやすく解説します。`,
    h1: "最強開運日はいつ？天赦日と一粒万倍日が重なる日",
    breadcrumbs: [{ name: "六曜カレンダー", path: "" }, { name: "最強開運日はいつ？", path: saikyobiPath }],
    body,
  }));
}

// ---- 祝日カレンダーページ ----
function buildShukujitsuGuide() {
  const monthPublished = (y, m) => MONTHS.some(mo => mo.y === y && mo.m === m);
  const cnt = (list, type) => list.filter(h => h.type === type).length;
  const l26 = SHUKUJITSU_BY_YEAR[2026], l27 = SHUKUJITSU_BY_YEAR[2027];

  const yearTable = y => {
    const list = SHUKUJITSU_BY_YEAR[y];
    const rows = list.map(h => {
      const label = `${h.m}月${h.d}日(${WDAYS[h.wday]})`;
      const dateCell = monthPublished(h.y, h.m) ? `<a href="${rel(1, monthPath(h.y, h.m))}">${label}</a>` : label;
      const cls = h.wday === 6 ? "sat" : h.wday === 0 ? "sun" : "";
      return `<tr class="${cls}"><td>${dateCell}</td><td>${esc(h.name)}</td><td>${esc(h.rokuyo)}</td></tr>`;
    }).join("\n");
    return `<h2>${y}年の祝日・休日一覧（${list.length}日）</h2><div class="tbl"><table><thead><tr><th>日付(曜日)</th><th>祝日名</th><th>六曜</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  };

  const introText = `2026年は祝日${cnt(l26, "祝日")}日に振替休日${cnt(l26, "振替休日")}日・国民の休日${cnt(l26, "国民の休日")}日を加えた計${l26.length}日、`
    + `2027年は祝日${cnt(l27, "祝日")}日に振替休日${cnt(l27, "振替休日")}日を加えた計${l27.length}日が「国民の祝日に関する法律」に基づく休日です。`
    + `月別ページへのリンクからは、その日の六曜（大安・友引など）もあわせて確認できます。`;

  const sw = [19, 20, 21, 22, 23].map(d => ({ d, wday: wdayOf(2026, 9, d) }));
  const swLabel = sw.map(x => `${x.d}日(${WDAYS[x.wday]})`).join("・");
  const gw = [1, 2, 3, 4, 5].map(d => ({ d, wday: wdayOf(2027, 5, d) }));
  const gwLabel = gw.map(x => `${x.d}日(${WDAYS[x.wday]})`).join("・");

  const body = `
<section class="feature"><p>${introText}</p></section>
${yearTable(2026)}
${yearTable(2027)}
<h2>シルバーウィーク2026はいつ？9月${swLabel}の5連休</h2>
<p>2026年は9月19日(土)・20日(日)の週末に続けて、21日(月)<a href="${rel(1, monthPath(2026, 9))}">敬老の日</a>、22日(火)国民の休日、23日(水)秋分の日と祝日が3日連続します。間に平日を挟まないため、9月${swLabel}が5連休になります。この並びは「国民の休日」（後述）によって敬老の日と秋分の日の間の平日が休日になることで生まれています。祝日・休日は<a href="${rel(1, monthPath(2026, 9))}">2026年9月のカレンダー</a>で日別の六曜とあわせて確認できます。</p>
<h2>ゴールデンウィーク2027は5月${gwLabel}</h2>
<p>2027年のゴールデンウィークは、5月1日(土)・2日(日)の週末に憲法記念日（5月3日）・みどりの日（5月4日）・こどもの日（5月5日）が続き、5月${gwLabel}の5連休になります。憲法記念日が日曜日ではないため振替休日は発生しません。詳しくは<a href="${rel(1, monthPath(2027, 5))}">2027年5月のカレンダー</a>をご覧ください。</p>
<p>年末年始は、2026年12月31日(木)を挟んで2027年1月1日(金)が元日、2日(土)・3日(日)と続くため、大型連休というよりは3連休程度の並びになります。年末年始の予定を立てる際は、<a href="${rel(1, nengajoPath)}">年賀状はいつまでに出す？喪中はがき・寒中見舞いの時期</a>もあわせてご確認ください。</p>
<h2>振替休日とは</h2>
<p>振替休日は、祝日が日曜日にあたった場合に、その直後で最初に祝日ではない日を休日とする制度です（祝日法第3条第2項）。2026年は5月3日の憲法記念日が日曜日にあたるため、5月4日・5日は他の祝日（みどりの日・こどもの日）ですでに埋まっており、その次の5月6日が振替休日になります。2027年は3月21日の春分の日が日曜日にあたるため、翌3月22日が振替休日です。</p>
<h2>国民の休日とは</h2>
<p>国民の休日は、前日と翌日をともに祝日に挟まれた、祝日でも日曜日でもない平日を休日とする制度です（祝日法第3条第3項）。2026年は9月21日の敬老の日と9月23日の秋分の日に挟まれた9月22日が該当し、国民の休日になります。ハッピーマンデー制度で敬老の日が9月第3月曜に固定された結果、秋分の日（毎年9月22日か23日ごろ）との位置関係次第で発生する、シルバーウィーク特有の休日です。</p>
<section class="note"><p>祝日は「国民の祝日に関する法律」に基づきます。春分の日・秋分の日は当サイトの天文計算（太陽の黄経が0°・180°になる瞬間）で算出していますが、法律上は前年2月の閣議決定・暦要項の官報公告により正式に確定します。2026年・2027年分は、いずれも官報で確定済みの日付と一致することを確認済みです。</p></section>
<section class="faq"><h2>よくある質問</h2><dl>
<dt>2026年のシルバーウィークはいつ？</dt><dd>9月${swLabel}の5連休です。敬老の日・国民の休日・秋分の日が3日連続することで生まれます。</dd>
<dt>国民の休日と振替休日の違いは？</dt><dd>振替休日は祝日が日曜日と重なったときの繰り替え、国民の休日は2つの祝日に挟まれた平日が休日になる制度です。どちらも祝日法に基づきます。</dd>
<dt>2027年のゴールデンウィークは何連休？</dt><dd>5月1日(土)〜5日(水)の5連休です。祝日が日曜日と重ならないため振替休日は発生しません。</dd>
</dl></section>
${kichijitsuLinks(1)}
${guideLinks(1)}`;

  writePage(`${shukujitsuPath}index.html`, shell({
    path: shukujitsuPath, depth: 1,
    title: "祝日カレンダー【2026年・2027年】振替休日・連休一覧",
    desc: `2026年・2027年の祝日・休日を六曜つきで一覧掲載。9月${swLabel}のシルバーウィーク2026、5月${gwLabel}のゴールデンウィーク2027、振替休日・国民の休日の仕組みをわかりやすく解説します。`,
    h1: "祝日カレンダー｜振替休日・連休一覧",
    breadcrumbs: [{ name: "六曜カレンダー", path: "" }, { name: "祝日カレンダー", path: shukujitsuPath }],
    body,
  }));
}

// ---- 年賀状・喪中はがき・寒中見舞いページ ----
function buildNengajoGuide() {
  const fmt = (y, m, d) => {
    const wday = wdayOf(y, m, d);
    return `${y}年${m}月${d}日(${WDAYS[wday]})`;
  };
  const rokuyoOf = (y, m, d) => conv(y, m, d).rokuyo;
  const row = (label, y, m, d, note) =>
    `<tr><td>${esc(label)}</td><td>${fmt(y, m, d)}</td><td>${esc(rokuyoOf(y, m, d))}</td><td>${esc(note)}</td></tr>`;

  const scheduleTable = `<div class="tbl"><table><thead><tr><th>項目</th><th>日付の目安</th><th>六曜</th><th>備考</th></tr></thead><tbody>
${row("年賀状の引受開始", 2026, 12, 15, "例年ベースの目安")}
${row("元日配達の投函目安", 2026, 12, 25, "この日までの投函が目安")}
${row("松の内（関東など）", 2027, 1, 7, "これ以降は寒中見舞いに")}
${row("松の内（関西など）", 2027, 1, 15, "地域により異なるとされる")}
${row("寒中見舞いの開始目安", 2027, 1, 8, "松の内が明けてから")}
${row("立春（寒中見舞いの終わり目安）", 2027, 2, 4, "これ以降は余寒見舞いに")}
</tbody></table></div>`;

  const body = `
<section class="feature"><p>年賀状は例年12月15日ごろに引き受けが始まり、元日に届けるには<strong>12月25日ごろまで</strong>の投函が目安とされています。喪中はがきは、相手が年賀状を準備し始める前の<strong>11月中〜12月上旬ごろまで</strong>に届くよう出すのが目安とされ、松の内（1月7日、地域により1月15日ごろ）を過ぎてからの年始のあいさつは、寒中見舞いに切り替えるのが一般的とされています。2026年12月〜2027年2月の実際の日付・曜日・六曜を表にまとめました。</p></section>
<h2>年賀状・寒中見舞いのスケジュール【2026年-2027年】</h2>
${scheduleTable}
<p class="note">日本郵便の2026年12月分の年賀状引受開始日は、本ページ執筆時点でまだ公式発表されていません。上表は例年のスケジュール（<a href="https://www.post.japanpost.jp/question/140.html" target="_blank" rel="noopener">日本郵便公式サイト</a>の直近年の実績）をもとにした目安です。正式な日付は日本郵便の発表でご確認ください。</p>
<h2>年賀状はいつまでに出す？</h2>
<p>年賀状の引受は例年12月15日ごろに始まり、元日（1月1日）に届けるための投函は<strong>12月25日ごろまで</strong>が目安とされています。これを過ぎても松の内（1月7日ごろ、関西では1月15日ごろとされる）までに届くのであれば年賀状として問題ないとされ、それ以降は「寒中見舞い」に切り替えるのがマナーとされています。</p>
<h2>喪中はがきはいつまでに出す？</h2>
<p>喪中はがき（年賀欠礼状）は、相手が年賀状を準備し始める前に届くよう、<strong>11月中〜12月上旬ごろまで</strong>に出すのが目安とされています。年賀状の受付が例年12月15日ごろから始まることをふまえると、遅くとも12月上旬までには相手に届くようにしたいところです。あまり早く出しすぎると相手が忘れてしまうこともあるとされるため、11月中旬以降が目安になるとされています。</p>
<p>喪中の範囲について明確な決まりはありませんが、一般的には二親等（親・子・兄弟姉妹・祖父母・孫）までを目安とする考え方が多いとされています。同居の有無や故人との関係の深さによって喪中はがきを出すかどうかを判断する方も多く、厳密なルールがあるわけではありません。</p>
<h2>寒中見舞いはいつからいつまで？</h2>
<p>寒中見舞いは、松の内が明けた1月8日ごろから、立春（2月4日ごろ）までに届くよう送るのが目安とされています。年賀状を出しそびれた場合の返礼や、喪中はがきをもらった相手への年始のあいさつとして使われることが多く、立春を過ぎると「余寒見舞い」に呼び方が変わるとされています。</p>
<section class="faq"><h2>よくある質問</h2><dl>
<dt>年賀状は12月25日を過ぎても出していい？</dt><dd>元日配達の目安は過ぎますが、松の内（1月7日ごろ）までに届くのであれば年賀状として問題ないとされています。それ以降は寒中見舞いに切り替えるのが一般的です。</dd>
<dt>喪中はがきを出しそびれた場合は？</dt><dd>12月に入ってから不幸があった場合など、喪中はがきが間に合わないときは、松の内明けから立春までの間に寒中見舞いとしてあいさつを送る方法があるとされています。</dd>
<dt>喪中はがきをもらったら年賀状は出さない？</dt><dd>喪中はがきは「こちらから年賀状を出せません」という知らせであり、相手に年賀状を送ってはいけないという意味ではないとされています。気になる場合は寒中見舞いで返すという考え方もあります。</dd>
</dl></section>
${affiliateBlock(NENGAJO_GOODS, "年賀状・喪中はがきの準備に")}
<h2>あわせてチェック</h2>
<div class="links"><a href="${rel(1, shukujitsuPath)}">祝日カレンダー｜振替休日・連休一覧</a></div>
${guideLinks(1)}`;

  writePage(`${nengajoPath}index.html`, shell({
    path: nengajoPath, depth: 1,
    title: "年賀状はいつまでに出す？喪中はがき・寒中見舞いの時期【2026-2027】",
    desc: "年賀状は例年12月15日ごろ受付開始、元日配達は12月25日ごろまでが目安。喪中はがきは11月中〜12月上旬まで、寒中見舞いは松の内明け(1月8日ごろ)〜立春(2月4日ごろ)が目安です。2026年末〜2027年始の日付・曜日・六曜つきで解説します。",
    h1: "年賀状はいつまでに出す？喪中はがき・寒中見舞いの時期",
    breadcrumbs: [{ name: "六曜カレンダー", path: "" }, { name: "年賀状はいつまで？", path: nengajoPath }],
    body,
  }));
}

// ---- ガイドページ ----
function buildGuide(slug, title, descText, h1, bodyHtml) {
  writePage(`guide/${slug}/index.html`, shell({
    path: `guide/${slug}/`, depth: 2,
    title, desc: descText, h1,
    breadcrumbs: [{ name: "六曜カレンダー", path: "" }, { name: h1, path: `guide/${slug}/` }],
    body: bodyHtml,
  }));
}

function buildGuides() {
  buildGuide("imi",
    "六曜とは？意味と順番をわかりやすく解説",
    "六曜（大安・友引・先勝・先負・仏滅・赤口）それぞれの意味と、旧暦の月と日で決まる順番のルール、中国起源とされる歴史をわかりやすく解説します。",
    "六曜とは？意味と順番", `
<section class="feature"><p>六曜（ろくよう）は、大安・赤口・先勝・友引・先負・仏滅の6種類からなる暦注（こよみに添えられた吉凶占い）の一つです。冠婚葬祭の日取りを選ぶ際に、今でも参考にする方が多い風習とされています。</p></section>
<h2>六曜それぞれの意味</h2>
<div class="tbl"><table><thead><tr><th>六曜</th><th>一般的な解釈</th></tr></thead><tbody>
<tr><td>大安</td><td>一日を通して吉とされ、何をするにも良い日とされています</td></tr>
<tr><td>赤口</td><td>正午前後のみ吉、朝夕は凶とされています</td></tr>
<tr><td>先勝</td><td>午前中が吉、午後は凶とされています（「先んずれば勝つ」の意）</td></tr>
<tr><td>友引</td><td>昼は凶、朝夕は吉とされています。「友を引く」の語呂から、葬式を避ける風習があります</td></tr>
<tr><td>先負</td><td>午前は凶、午後が吉とされています（「先んずれば負ける」の意）</td></tr>
<tr><td>仏滅</td><td>一日を通して凶とされ、六曜の中では最も凶の日とされています</td></tr>
</tbody></table></div>
<h2>順番が決まる仕組み</h2>
<p>六曜は旧暦（太陰太陽暦）の<strong>月と日を足した数を6で割った余り</strong>で決まるとされています。同じ順序（大安→赤口→先勝→友引→先負→仏滅…）で毎日循環しますが、旧暦の月が替わるタイミングで一度リセットされるため、そこだけ順番が飛ぶことがあります。当サイトの月別ページで、月替わりの直後に順番が飛んでいる箇所を確認できます。</p>
<h2>六曜の歴史</h2>
<p>六曜は中国が起源とされ、日本には鎌倉〜室町時代ごろに伝わったとされています。当初は現在と名称も順番も異なっていましたが、江戸時代後期に現在の形に整理され、庶民の間で広まったとされています。暦の吉凶を占う風習の一つであり、<strong>科学的な根拠はない</strong>とされている点には注意が必要です。生まれ年の干支や年齢を調べたい方は<a href="https://claudetarouggl-coder.github.io/nenrei-hayami/eto/">干支早見表（年齢早見表）</a>をどうぞ。</p>
<h2>大安の日取りを探す</h2>
${taianLinks(2)}
${guideLinks(2)}`);

  buildGuide("kekkonshiki",
    "仏滅・友引の結婚式はダメ？気にする人・気にしない人",
    "仏滅や友引に結婚式をしてはいけないという決まりはありません。世代による意識の差や、仏滅割引プランの存在、大安土日は式場が埋まりやすい事情などをふまえ、日取り選びの考え方を解説します。",
    "仏滅・友引の結婚式はダメ？", `
<section class="feature"><p>結論から言うと、仏滅や友引に結婚式をしてはいけないという公式な決まりはありません。六曜は宗教とは関係のない暦注（こよみの吉凶占い）の一つで、気にするかどうかは個人や家庭の考え方次第とされています。</p></section>
<h2>気にする人の割合には世代差がある</h2>
<p>年配の親族ほど六曜を意識する傾向がある一方、当人同士やより若い世代では「気にしない」という声も多く聞かれます。招待するゲストの世代構成によっては、念のため大安・友引を優先する家庭もあります。</p>
<h2>仏滅は式場が空いていて割引プランもある</h2>
<p>仏滅や先負は式場の予約が入りにくいため、<strong>割引プランや優先的な空き枠</strong>を用意している式場も少なくありません。日取りにこだわらない場合は、費用面や希望日の取りやすさでメリットがあります。</p>
<h2>大安の土日は式場が埋まりやすい</h2>
<p>逆に大安の土日は人気が集中し、早い時期から予約で埋まりやすい傾向にあります。大安にこだわる場合は、半年〜1年以上前からの予約がおすすめです。年間の大安の日取りは<a href="${rel(2, "taian/2026/")}">2026年の大安一覧</a>・<a href="${rel(2, "taian/2027/")}">2027年の大安一覧</a>から確認できます。入籍日の年齢・記念日の計算には<a href="https://claudetarouggl-coder.github.io/nenrei-hayami/">年齢早見表</a>も便利です。</p>
<h2>最終的には当人たちの判断で</h2>
<p>六曜に科学的な根拠はなく、あくまで伝統的な風習の一つです。親族の意向も踏まえつつ、最終的には結婚するふたりが納得できる日取りを選ぶのがよいとされています。</p>
${affiliateBlock(GOODS.filter(g => g.label === "結婚祝い"), "結婚祝いを探す")}
<h2>大安の日取りを探す</h2>
${taianLinks(2)}
${guideLinks(2)}`);

  buildGuide("tomobiki",
    "友引に葬式を避けるのはなぜ？由来と実務上の理由",
    "友引の葬式を避ける風習は「友を引く」という語呂合わせの俗信が由来とされ、仏教の教えとは無関係です。火葬場が友引を休業日にしている実務上の事情もあわせて解説します。",
    "友引に葬式を避けるのはなぜ？", `
<section class="feature"><p>「友引の日に葬式（告別式）をすると、故人が友人をあの世に引き連れて行ってしまう」という言い伝えから、友引の葬式を避ける風習があるとされています。ただし、これは語呂合わせによる俗信であり、宗教的な教えに基づくものではないとされています。</p></section>
<h2>「友を引く」という語呂合わせが由来</h2>
<p>友引はもともと「共引」と書き、六曜の中では「勝負がつかず引き分けになる日」を意味していたとされています。それが「友を引く」という漢字・語呂に結びつけられ、葬式を避ける風習に転じたと言われています。</p>
<h2>火葬場が休業日にしている地域が多い</h2>
<p>この風習が広まった結果、現在では友引を定休日にしている火葬場が全国的に多く見られます。喪主側が気にしていなくても、<strong>火葬場が休みで物理的に葬式を行えない</strong>という実務上の理由から、友引に葬式をしない慣習が続いているという側面もあります。</p>
<h2>通夜は友引でも問題ないとされる</h2>
<p>避けられるのは主に告別式（葬式）で、前日に行う通夜は友引でも問題ないとされています。友引を避けたい場合は、通夜を友引に、葬式を翌日にずらす形で日程を組むことが多いです。</p>
<h2>宗教的な根拠はない</h2>
<p>仏教の教えの中に「友引に葬式をしてはいけない」という決まりはなく、六曜自体、仏教とは無関係な暦注とされています。実際、浄土真宗などでは六曜を迷信として気にしない考え方をとる寺院もあります。菩提寺がある場合は、事前に六曜についての考え方を確認しておくと安心です。</p>
${guideLinks(2)}`);

  buildGuide("ichiryumanbai-imi",
    "一粒万倍日とは？やると良いこと・避けること一覧",
    "一粒万倍日とは何をする日かを解説。財布の新調・開業・入籍・宝くじ購入などやると良いとされることと、借金の契約やお金の貸し借りなど避けたほうがいいとされることを一覧で紹介。天赦日や大安と重なる日、仏滅と重なった場合の考え方もあわせて解説します。",
    "一粒万倍日とは？やると良いこと・避けること", `
<section class="feature"><p>一粒万倍日（いちりゅうまんばいび）は「一粒の籾（もみ）が万倍に実る」という意味を持つ選日（暦の吉日の一種）で、始めたことが大きく育つ日とされています。節切りの月ごとに十二支の日が割り当てられているため月に4〜7回ほど巡ってきて、吉日の中では比較的頻度が高いのが特徴です。</p></section>
<h2>やると良いとされること</h2>
<ul>
<li><strong>財布の新調・使い始め</strong> — 新しい財布を使い始めると、お金が増えて返ってくることを願う縁起担ぎとされています。</li>
<li><strong>開業・開店・新しい仕事のスタート</strong> — 始めた仕事が大きく育つことを願って、開業日に選ぶ人が多いとされています。</li>
<li><strong>銀行口座の開設・投資や貯金の開始</strong> — 口座開設や積立の開始日に選ぶと、資産が増えていくことを願う意味合いがあるとされています。</li>
<li><strong>宝くじの購入</strong> — 当選金が万倍に増えることを願って、購入日に選ぶ人が多いとされています。</li>
<li><strong>入籍・プロポーズ</strong> — 二人の幸せが大きく育つことを願って選ばれる日取りの一つとされています。</li>
<li><strong>引っ越し・契約ごと</strong> — 新生活や新しい契約が良い方向に発展することを願って選ばれるとされています。</li>
</ul>
<h2>避けたほうがいいとされること</h2>
<ul>
<li><strong>借金・ローンの契約</strong> — お金だけでなく苦労や負債も万倍に増えてしまうという言い伝えから、避けたほうがよいとされています。</li>
<li><strong>人からお金や物を借りる</strong> — 借りたものが万倍になって返ってくる、つまり返済の負担が増えると考えられ、避ける方が多いとされています。</li>
<li><strong>けんか・悪口などのトラブルごと</strong> — 悪いことも大きくなるとされるため、争いごとは避けたほうがよいという考え方があります。</li>
</ul>
<h2>他の吉日と重なるとどうなる？</h2>
<p>一粒万倍日が<a href="${rel(2, tenshaPath(2026))}">天赦日</a>や<a href="${rel(2, "taian/2026/")}">大安</a>と重なる日は特に縁起が良いとされ、結婚式や開業日として選ぶ人が多い人気の日取りです。どの日が重なる日にあたるかは<a href="${rel(2, ichiryuPath(2026))}">2026年の一粒万倍日一覧</a>・<a href="${rel(2, ichiryuPath(2027))}">2027年の一粒万倍日一覧</a>で確認できます。一方、仏滅や<a href="${rel(2, "fujojubi/")}">不成就日</a>（何事も成就しないとされる選日）と重なった場合にどちらを優先するかは考え方次第で、気にしない方も多いとされています。不成就日の日付は<a href="${rel(2, fujojuPath(2026))}">2026年</a>・<a href="${rel(2, fujojuPath(2027))}">2027年</a>の一覧から確認できます。</p>
<section class="faq"><h2>よくある質問</h2><dl>
<dt>一粒万倍日は月に何回ありますか？</dt><dd>節切りの月ごとに十二支2つが割り当てられているため月によって異なりますが、おおむね4〜7回ほど巡ってくるとされています。</dd>
<dt>一粒万倍日に納車してもいい？</dt><dd>新しい車が長く活躍することを願って選ぶ人が多く、納車日にも人気の吉日とされています。特に決まりはないため、大安や天赦日と重なる日を選ぶ方もいます。</dd>
<dt>仏滅と重なった日はどうすれば？</dt><dd>一粒万倍日と仏滅が重なった場合、どちらを優先するかは考え方次第とされています。始めごとを重視して一粒万倍日を優先する方もいれば、仏滅を避けて別日にする方もいます。</dd>
</dl></section>
${affiliateBlock(GOODS, "一粒万倍日に合わせて選びたいギフト・縁起物")}
<h2>あわせてチェック</h2>
${kichijitsuLinks(2)}
${guideLinks(2)}`);
}

// ---- トップページ ----
function buildHome() {
  const todayKey = `${TODAY.y}-${TODAY.m}-${TODAY.d}`;
  const todayInRange = Object.prototype.hasOwnProperty.call(DAY_MAP, todayKey);
  const todayConv = todayInRange ? conv(TODAY.y, TODAY.m, TODAY.d) : null;
  const todayMonthPath = todayInRange ? monthPath(TODAY.y, TODAY.m) : monthPath(MONTHS[0].y, MONTHS[0].m);

  const todayRemark = todayInRange ? REMARK_MAP[todayKey] : null;
  const todayCardHtml = todayInRange
    ? `<div class="lb">今日（${TODAY.y}年${TODAY.m}月${TODAY.d}日）の六曜</div><div class="vl" id="today-rokuyo">${esc(todayConv.rokuyo)}</div><div class="lb">${esc(lunarStrOf(todayConv))}${todayRemark ? `・${esc(todayRemark)}` : ""}・詳しくは<a href="${rel(0, todayMonthPath)}">${TODAY.y}年${TODAY.m}月のカレンダー</a></div>`
    : `<div class="lb" id="today-rokuyo">今日の六曜情報は公開期間外です</div><div class="lb">下記の月別ページからご確認ください</div>`;

  const yearGroups = [2026, 2027].map(y => {
    const months = MONTHS.filter(mo => mo.y === y);
    const links = months.map(mo => `<a href="${rel(0, monthPath(mo.y, mo.m))}">${mo.m}月</a>`).join("");
    return `<h3>${y}年</h3><div class="links">${links}</div>`;
  }).join("\n");

  const body = `
<section class="today" id="today-card">${todayCardHtml}</section>
<section class="feature"><p>六曜（大安・友引・先勝・先負・仏滅・赤口）と旧暦を、2026年8月〜2027年12月の期間で日別に確認できるカレンダーサイトです。結婚式・入籍・納車・引っ越しなど、日取りを選ぶ際の参考にご利用ください。</p></section>
<h2>月別カレンダー</h2>
${yearGroups}
<h2>大安・仏滅・友引・一粒万倍日・天赦日・不成就日を年間でチェック</h2>
${kichijitsuLinks(0)}
${guideLinks(0)}
<section class="faq"><h2>よくある質問</h2><dl>
<dt>今日の六曜がすぐ知りたい</dt><dd>このページ上部の「今日の六曜」カードでご確認いただけます。</dd>
<dt>大安の日取りを探したい</dt><dd><a href="${rel(0, "taian/2026/")}">2026年の大安一覧</a>・<a href="${rel(0, "taian/2027/")}">2027年の大安一覧</a>から月別に確認できます。</dd>
<dt>一粒万倍日・天赦日の日取りを探したい</dt><dd><a href="${rel(0, ichiryuPath(2026))}">一粒万倍日 2026年</a>・<a href="${rel(0, ichiryuPath(2027))}">2027年</a>、<a href="${rel(0, tenshaPath(2026))}">天赦日 2026年</a>・<a href="${rel(0, tenshaPath(2027))}">2027年</a>の一覧から確認できます。</dd>
<dt>六曜の意味を知りたい</dt><dd><a href="${rel(0, "guide/imi/")}">六曜とは？意味と順番</a>で、それぞれの意味と決まり方を解説しています。</dd>
</dl></section>`;

  const websiteJson = `<script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org", "@type": "WebSite",
    name: "六曜カレンダー", url: BASE,
  })}</script>`;

  const script = `<script>
var ROKUYO_MAP=${JSON.stringify(DAY_MAP)};
var REMARK_MAP=${JSON.stringify(REMARK_MAP)};
var MONTH_URL="${BASE}";
(function(){
  var now=new Date(Date.now()+540*60000);
  var y=now.getUTCFullYear(),m=now.getUTCMonth()+1,d=now.getUTCDate();
  var key=y+"-"+m+"-"+d;
  if(key==="${TODAY.y}-${TODAY.m}-${TODAY.d}")return; // ビルド当日はサーバー描画（旧暦つき）のまま
  var card=document.getElementById("today-card");
  if(!card)return;
  if(Object.prototype.hasOwnProperty.call(ROKUYO_MAP,key)){
    var mm=(m<10?"0":"")+m;
    var url=MONTH_URL+y+"/"+mm+"/";
    var remark=REMARK_MAP[key];
    card.innerHTML='<div class="lb">今日（'+y+'年'+m+'月'+d+'日）の六曜</div><div class="vl">'+ROKUYO_MAP[key]+'</div><div class="lb">旧暦の日付は<a href="'+url+'">'+y+'年'+m+'月のカレンダー</a>でご確認いただけます'+(remark?'（'+remark+'）':'')+'</div>';
  }else{
    card.innerHTML='<div class="lb">今日の六曜情報は公開期間外です</div><div class="lb">下記の月別ページからご確認ください</div>';
  }
})();
</script>`;

  writePage("index.html", shell({
    path: "", depth: 0,
    title: "六曜カレンダー｜今日の大安・仏滅がすぐわかる",
    desc: "六曜（大安・友引・先勝・先負・仏滅・赤口）と旧暦を日別に確認できるカレンダー。2026年8月〜2027年12月の月別ページと、結婚式・入籍・納車・引っ越しの日取りに便利な大安一覧を掲載。",
    h1: "六曜カレンダー",
    breadcrumbs: [],
    body,
    extraHead: websiteJson,
    extraScript: script,
  }));
}

function build404() {
  writePage("404.html", `<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"><title>ページが見つかりません</title><style>${CSS}</style></head>
<body><main style="text-align:center;padding-top:3rem"><h1>ページが見つかりません</h1><p><a href="${BASE}">六曜カレンダー トップへ</a></p></main></body></html>`);
}
function buildSitemap() {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${emittedUrls.map(u => `  <url><loc>${u}</loc><lastmod>${TODAY_STR}</lastmod></url>`).join("\n")}
</urlset>
`;
  fs.writeFileSync(path.join(OUT, "sitemap.xml"), xml);
}

// ---- 実行 ----
fs.rmSync(OUT, { recursive: true, force: true });
ALL_MONTHS_DATA.forEach((_, i) => buildMonthPage(i));
buildTaianPage(2026);
buildTaianPage(2027);
buildButsumetsuPage(2026);
buildButsumetsuPage(2027);
buildTomobikiPage(2026);
buildTomobikiPage(2027);
buildIchiryuPage(2026);
buildIchiryuPage(2027);
buildTenshaPage(2026);
buildTenshaPage(2027);
buildFujojuPage(2026);
buildFujojuPage(2027);
buildFujojuGuide();
buildMeigetsuGuide();
buildSaikyobiGuide();
buildShukujitsuGuide();
buildNengajoGuide();
buildGuides();
buildHome();
build404();
buildSitemap();
fs.writeFileSync(path.join(OUT, ".nojekyll"), "");

// 整合性チェック
for (const t of linkTargets) {
  const f = path.join(OUT, t, "index.html");
  if (!fs.existsSync(f)) throw new Error(`BROKEN LINK TARGET: ${t}`);
}
const expected = 1 + ALL_MONTHS_DATA.length + 2 + 4 + 4 + 3 + 1 + 1 + 1 + 1 + 4; // home + 月別17 + 大安一覧2 + 仏滅/友引一覧4 + 一粒万倍日/天赦日4 + 不成就日3(解説+年別2) + 中秋の名月1 + 最強開運日1 + 祝日カレンダー1 + 年賀状ガイド1 + ガイド4
if (emittedUrls.length !== expected) throw new Error(`page count ${emittedUrls.length} != ${expected}`);
if (!emittedUrls.every(u => u.startsWith(BASE))) throw new Error("URL outside BASE");
console.log(`OK: ${emittedUrls.length} pages + 404 + sitemap generated for ${TODAY_STR}`);
