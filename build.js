"use strict";
// 六曜カレンダー 静的サイトジェネレータ
// 生成物: docs/ 以下に index.html + 月別17ページ + 大安一覧2ページ + ガイド3本 + sitemap.xml + 404.html
const fs = require("fs");
const path = require("path");
const { makeConverter } = require("./lib/kyureki");
const { GOODS } = require("./lib/affiliates");

const BASE = "https://claudetarouggl-coder.github.io/rokuyo-calendar/";
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
const daysInMonth = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const wdayOf = (y, m, d) => new Date(Date.UTC(y, m - 1, d)).getUTCDay();
const lunarStrOf = c => `旧暦${c.leap ? "閏" : ""}${c.month}月${c.day}日`;

function monthRows(y, m) {
  const last = daysInMonth(y, m);
  const rows = [];
  for (let d = 1; d <= last; d++) {
    const c = conv(y, m, d);
    rows.push({ d, wday: wdayOf(y, m, d), rokuyo: c.rokuyo, lunarStr: lunarStrOf(c) });
  }
  return rows;
}

const ALL_MONTHS_DATA = MONTHS.map(({ y, m }) => ({ y, m, rows: monthRows(y, m) }));

// トップページの「今日の六曜」用: 公開範囲全日の六曜だけを持つ軽量マップ
const DAY_MAP = {};
for (const { y, m, rows } of ALL_MONTHS_DATA) for (const r of rows) DAY_MAP[`${y}-${m}-${r.d}`] = r.rokuyo;

// 大安一覧（年別）
const TAIAN_BY_YEAR = {};
for (const { y, m, rows } of ALL_MONTHS_DATA) {
  TAIAN_BY_YEAR[y] = TAIAN_BY_YEAR[y] || [];
  for (const r of rows) if (r.rokuyo === "大安") TAIAN_BY_YEAR[y].push({ y, m, d: r.d, wday: r.wday });
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
<a href="${rel(depth, "guide/tomobiki/")}">友引に葬式を避けるのはなぜ？</a></div>`;

const taianLinks = depth => `<div class="links">
<a href="${rel(depth, "taian/2026/")}">2026年の大安一覧</a>
<a href="${rel(depth, "taian/2027/")}">2027年の大安一覧</a></div>`;

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
    return `<tr class="${cls}"><td>${r.d}日(${WDAYS[r.wday]})</td><td>${esc(r.rokuyo)}</td><td>${esc(r.lunarStr)}</td></tr>`;
  }).join("\n");

  const prevM = idx > 0 ? ALL_MONTHS_DATA[idx - 1] : null;
  const nextM = idx < ALL_MONTHS_DATA.length - 1 ? ALL_MONTHS_DATA[idx + 1] : null;
  const prevNav = prevM ? `<a href="${rel(2, monthPath(prevM.y, prevM.m))}">← ${prevM.y}年${prevM.m}月</a>` : "<span></span>";
  const nextNav = nextM ? `<a href="${rel(2, monthPath(nextM.y, nextM.m))}">${nextM.y}年${nextM.m}月 →</a>` : "<span></span>";

  const body = `
<section class="feature"><p>${introText}</p></section>
<div class="tbl"><table>
<thead><tr><th>日付(曜日)</th><th>六曜</th><th>旧暦</th></tr></thead>
<tbody>${tableRows}</tbody></table></div>
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
<p>六曜は中国が起源とされ、日本には鎌倉〜室町時代ごろに伝わったとされています。当初は現在と名称も順番も異なっていましたが、江戸時代後期に現在の形に整理され、庶民の間で広まったとされています。暦の吉凶を占う風習の一つであり、<strong>科学的な根拠はない</strong>とされている点には注意が必要です。</p>
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
<p>逆に大安の土日は人気が集中し、早い時期から予約で埋まりやすい傾向にあります。大安にこだわる場合は、半年〜1年以上前からの予約がおすすめです。年間の大安の日取りは<a href="${rel(2, "taian/2026/")}">2026年の大安一覧</a>・<a href="${rel(2, "taian/2027/")}">2027年の大安一覧</a>から確認できます。</p>
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
}

// ---- トップページ ----
function buildHome() {
  const todayKey = `${TODAY.y}-${TODAY.m}-${TODAY.d}`;
  const todayInRange = Object.prototype.hasOwnProperty.call(DAY_MAP, todayKey);
  const todayConv = todayInRange ? conv(TODAY.y, TODAY.m, TODAY.d) : null;
  const todayMonthPath = todayInRange ? monthPath(TODAY.y, TODAY.m) : monthPath(MONTHS[0].y, MONTHS[0].m);

  const todayCardHtml = todayInRange
    ? `<div class="lb">今日（${TODAY.y}年${TODAY.m}月${TODAY.d}日）の六曜</div><div class="vl" id="today-rokuyo">${esc(todayConv.rokuyo)}</div><div class="lb">${esc(lunarStrOf(todayConv))}・詳しくは<a href="${rel(0, todayMonthPath)}">${TODAY.y}年${TODAY.m}月のカレンダー</a></div>`
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
<h2>大安の日取りを年間でチェック</h2>
${taianLinks(0)}
${guideLinks(0)}
<section class="faq"><h2>よくある質問</h2><dl>
<dt>今日の六曜がすぐ知りたい</dt><dd>このページ上部の「今日の六曜」カードでご確認いただけます。</dd>
<dt>大安の日取りを探したい</dt><dd><a href="${rel(0, "taian/2026/")}">2026年の大安一覧</a>・<a href="${rel(0, "taian/2027/")}">2027年の大安一覧</a>から月別に確認できます。</dd>
<dt>六曜の意味を知りたい</dt><dd><a href="${rel(0, "guide/imi/")}">六曜とは？意味と順番</a>で、それぞれの意味と決まり方を解説しています。</dd>
</dl></section>`;

  const websiteJson = `<script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org", "@type": "WebSite",
    name: "六曜カレンダー", url: BASE,
  })}</script>`;

  const script = `<script>
var ROKUYO_MAP=${JSON.stringify(DAY_MAP)};
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
    card.innerHTML='<div class="lb">今日（'+y+'年'+m+'月'+d+'日）の六曜</div><div class="vl">'+ROKUYO_MAP[key]+'</div><div class="lb">旧暦の日付は<a href="'+url+'">'+y+'年'+m+'月のカレンダー</a>でご確認いただけます</div>';
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
const expected = 1 + ALL_MONTHS_DATA.length + 2 + 3; // home + 月別17 + 大安一覧2 + ガイド3
if (emittedUrls.length !== expected) throw new Error(`page count ${emittedUrls.length} != ${expected}`);
if (!emittedUrls.every(u => u.startsWith(BASE))) throw new Error("URL outside BASE");
console.log(`OK: ${emittedUrls.length} pages + 404 + sitemap generated for ${TODAY_STR}`);
