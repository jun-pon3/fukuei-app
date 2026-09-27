export const RULE_CATEGORIES = [
  "配送・集荷",
  "出荷時の注意",
  "ラベル",
  "賞味期限",
  "伝票",
  "摘要欄",
  "請求書・納品書",
  "その他",
] as const;

export type RuleCategory = (typeof RULE_CATEGORIES)[number];

// 編集者候補（ログイン方法が未確定のため、暫定で担当者名を選択する方式）
export const STAFF = ["社長", "専務", "事務員"] as const;

export type Rule = {
  id: string;
  category: string;
  text: string;
  important: boolean;
};

export type Product = {
  id: string;
  name: string;
  alias: string; // 取引先独自の呼び方
  weight: string;
  spec: string;
};

export type LabelImage = {
  id: string;
  kind: "商品ラベル" | "外箱ラベル" | "その他";
  title: string;
  src: string; // 表示用の公開URL
  path: string; // Supabase Storage内のパス（削除時に使う）
  note: string;
};

export type ClientStatus = "active" | "suspended";

export type Client = {
  id: string;
  name: string;
  kana: string; // ふりがな（あいうえお順の並べ替え用）
  phone: string;
  fax: string;
  contact: string;
  address: string;
  carrier: string; // 配送会社
  directShip: string; // 直送先
  note: string; // その他必要情報
  status: ClientStatus;
  products: Product[];
  rules: Rule[];
  labels: LabelImage[];
  updatedAt: string;
};

export type HistoryEntry = {
  id: string;
  at: string;
  by: string;
  clientId: string;
  clientName: string;
  target: string; // 変更した項目
  before: string;
  after: string;
  reason: string;
  snapshotBefore: Client | null; // 復元用（新規登録時は null）
  restored?: boolean;
};

// ルールや画像パスなど、DBに保存しない一時的なID用（画面内でのkey識別のみに使う）
export const uid = () =>
  Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

// DBのuuid型カラム（clients.id）に使う、正しい形式のIDを発行する
export const newClientId = () => crypto.randomUUID();
