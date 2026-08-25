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

// 最強開運日（天赦日×一粒万倍日）に関連した定番アイテム
const SAIKYOBI_GOODS = [
  { label: "開運財布（長財布）", keyword: "開運財布 長財布", note: "最強開運日の財布の新調・使い始めに選ばれることが多いアイテム" },
  { label: "風水 財布 黄色", keyword: "風水 財布 黄色", note: "金運アップの定番色とされる黄色の財布" },
  { label: "宝くじ 保管 ケース", keyword: "宝くじ 保管 ケース", note: "購入した宝くじを大切に保管するための縁起物" },
].map(g => ({ ...g, url: searchLink(g.keyword) }));

// 年賀状・喪中はがきに関連した定番アイテム
const NENGAJO_GOODS = [
  { label: "年賀状 印刷", keyword: "年賀状 印刷", note: "投函目安の12月25日ごろに間に合わせたい方向けの印刷サービス" },
  { label: "喪中はがき 印刷", keyword: "喪中はがき 印刷", note: "11月中〜12月上旬までに届けたい方向けの印刷サービス" },
  { label: "年賀はがき インクジェット", keyword: "年賀はがき インクジェット", note: "自宅のプリンターで印刷する方向けの年賀はがき" },
].map(g => ({ ...g, url: searchLink(g.keyword) }));

// 戌の日・安産祈願に関連した定番アイテム
const INUNOHI_GOODS = [
  { label: "腹帯（岩田帯）", keyword: "腹帯 岩田帯", note: "帯祝いの定番。さらしタイプの伝統的な腹帯" },
  { label: "妊婦帯・マタニティベルト", keyword: "妊婦帯", note: "普段使いしやすいベルトタイプ。戌の日の帯祝い後も使えます" },
  { label: "安産祈願 お守り", keyword: "安産祈願 お守り", note: "戌の日のお参りと合わせて身につける方が多いお守り" },
].map(g => ({ ...g, url: searchLink(g.keyword) }));

module.exports = { GOODS, MOON_GOODS, SAIKYOBI_GOODS, NENGAJO_GOODS, INUNOHI_GOODS, searchLink };
