import type { Client } from "./types";

export type SearchHit = {
  client: Client;
  score: number;
  hint: string; // 会社名以外でヒットした場合の補足（ルール文言など）
};

// 全角/半角スペースで分割し、全角英数を半角にそろえて小文字化する
export function normalize(s: string): string {
  return s
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .toLowerCase();
}

export function tokenize(q: string): string[] {
  return normalize(q).split(/[\s　]+/).filter(Boolean);
}

const sortKey = (c: Client) => c.kana || c.name;

/** ふりがな（なければ会社名）のあいうえお順 */
export function sortByKana(clients: Client[]): Client[] {
  return [...clients].sort((a, b) => sortKey(a).localeCompare(sortKey(b), "ja"));
}

// 五十音の行見出し。ひらがな・カタカナ・英数字の先頭文字から決める
const ROWS: [string, string][] = [
  ["あ", "あいうえおぁぃぅぇぉ"], ["か", "かきくけこがぎぐげご"], ["さ", "さしすせそざじずぜぞ"],
  ["た", "たちつてとだぢづでどっ"], ["な", "なにぬねの"], ["は", "はひふへほばびぶべぼぱぴぷぺぽ"],
  ["ま", "まみむめも"], ["や", "やゆよゃゅょ"], ["ら", "らりるれろ"], ["わ", "わをん"],
];

function rowOf(c: Client): string {
  // カタカナはひらがなに直して判定
  const ch = sortKey(c).charAt(0).replace(/[ァ-ヶ]/g, (m) => String.fromCharCode(m.charCodeAt(0) - 0x60));
  return ROWS.find(([, chars]) => chars.includes(ch))?.[0] ?? "他";
}

export function groupByRow(clients: Client[]): { row: string; clients: Client[] }[] {
  const groups = new Map<string, Client[]>();
  for (const c of sortByKana(clients)) {
    const r = rowOf(c);
    groups.set(r, [...(groups.get(r) ?? []), c]);
  }
  return [...ROWS.map(([r]) => r), "他"]
    .filter((r) => groups.has(r))
    .map((r) => ({ row: r, clients: groups.get(r)! }));
}

export function searchClients(clients: Client[], q: string, showSuspended: boolean): SearchHit[] {
  const tokens = tokenize(q);
  const pool = clients.filter((c) => showSuspended || c.status === "active");
  if (tokens.length === 0) return [];

  const hits: SearchHit[] = [];
  for (const client of pool) {
    const name = normalize(`${client.name} ${client.kana}`);
    const otherFields = [
      client.address, client.carrier, client.directShip, client.contact, client.note, client.phone,
    ].map(normalize);
    const ruleTexts = client.rules.map((r) => ({
      raw: `${r.category}：${r.text}`,
      n: normalize(`${r.category} ${r.text}`),
    }));
    const productTexts = client.products.map((p) => normalize(`${p.name} ${p.alias}`));

    let score = 0;
    let matched = 0;
    let hint = "";
    for (const t of tokens) {
      if (name.includes(t)) {
        score += 10;
        matched++;
        continue;
      }
      const rule = ruleTexts.find((r) => r.n.includes(t));
      if (rule) {
        score += 5;
        matched++;
        if (!hint) hint = rule.raw;
        continue;
      }
      if (productTexts.some((p) => p.includes(t)) || otherFields.some((f) => f.includes(t))) {
        score += 2;
        matched++;
      }
    }
    if (matched === 0) continue;
    // 複数語の場合、すべてに合う会社を優先する
    if (matched === tokens.length) score += 100;
    hits.push({ client, score, hint });
  }
  return hits.sort((a, b) => b.score - a.score || sortKey(a.client).localeCompare(sortKey(b.client), "ja"));
}
