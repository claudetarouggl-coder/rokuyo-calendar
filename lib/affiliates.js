"use strict";
// 楽天アフィリエイト（専用楽天アカウント）。検索リンクはID固定・pc=差し替えで構築（curl 302検証済み、KNOWLEDGE.md参照）
const LINK_ID = "56939e6e.b614e71e.56939e6f.e56659e4";
const UT = "eyJwYWdlIjoidXJsIiwidHlwZSI6InRleHQiLCJjb2wiOjF9";
const searchLink = keyword =>
  `https://hb.afl.rakuten.co.jp/hgc/${LINK_ID}/?pc=${encodeURIComponent(`https://search.rakuten.co.jp/search/mall/${keyword}/`)}&link_type=text&ut=${UT}`;

// 六曜の日取りに関連した定番ギフト・縁起物
const GOODS = [
  { label: "結婚祝い", keyword: "結婚祝い", note: "大安の日を選んで贈ると喜ばれることが多いギフトです" },
  { label: "引っ越し挨拶ギフト", keyword: "引っ越し 挨拶 ギフト", note: "大安・友引の引っ越しに合わせて用意する方が多い定番アイテム" },
  { label: "交通安全お守り", keyword: "交通安全 お守り", note: "納車を大安に合わせる方が選ぶことの多いお守り" },
].map(g => ({ ...g, url: searchLink(g.keyword) }));

// 中秋の名月・お月見に関連した定番アイテム
const MOON_GOODS = [
  { label: "月見団子", keyword: "月見団子", note: "十五夜・十三夜のお供えに欠かせない定番の団子" },
  { label: "すすき（ドライフラワー）", keyword: "すすき ドライフラワー", note: "月見飾りの定番。生花が手に入らない時期でも飾れます" },
  { label: "三方（お供え台）", keyword: "三方 お供え台", note: "月見団子やすすきを供える台。木製の定番タイプ" },
].map(g => ({ ...g, url: searchLink(g.keyword) }));

module.exports = { GOODS, MOON_GOODS, searchLink };
