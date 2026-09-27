"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { labelPublicUrl, LABEL_BUCKET, supabase } from "./supabaseClient";
import { uid, type Client, type HistoryEntry, type LabelImage, type Product, type Rule } from "./types";

// データはSupabase（Postgres + Storage）に保存する。
// テーブル定義・保存/復元用の関数は supabase/migration.sql を参照。
const EDITOR_KEY = "fukuei-app-editor";
const RECENT_MAX = 8;

// ---- DBの行の型（snake_case） ----------------------------------------
type ClientRow = {
  id: string;
  name: string;
  kana: string;
  phone: string;
  fax: string;
  contact: string;
  address: string;
  carrier: string;
  direct_ship: string;
  note: string;
  status: "active" | "suspended";
  updated_at: string;
};
type RuleRow = { id: string; client_id: string; category: string; text: string; important: boolean };
type ProductRow = { id: string; client_id: string; name: string; alias: string; weight: string; spec: string };
type LabelRow = {
  id: string;
  client_id: string;
  kind: LabelImage["kind"];
  title: string;
  storage_path: string;
  note: string;
};
type HistoryRow = {
  id: string;
  at: string;
  by: string;
  client_id: string | null;
  client_name: string;
  target: string;
  before_text: string;
  after_text: string;
  reason: string;
  snapshot_before: Client | null;
  restored: boolean;
};

function toClient(row: ClientRow, rules: RuleRow[], products: ProductRow[], labels: LabelRow[]): Client {
  return {
    id: row.id,
    name: row.name,
    kana: row.kana,
    phone: row.phone,
    fax: row.fax,
    contact: row.contact,
    address: row.address,
    carrier: row.carrier,
    directShip: row.direct_ship,
    note: row.note,
    status: row.status,
    updatedAt: row.updated_at,
    rules: rules.map((r): Rule => ({ id: r.id, category: r.category, text: r.text, important: r.important })),
    products: products.map((p): Product => ({ id: p.id, name: p.name, alias: p.alias, weight: p.weight, spec: p.spec })),
    labels: labels.map(
      (l): LabelImage => ({
        id: l.id,
        kind: l.kind,
        title: l.title,
        note: l.note,
        path: l.storage_path,
        src: labelPublicUrl(l.storage_path),
      }),
    ),
  };
}

function toHistory(row: HistoryRow): HistoryEntry {
  return {
    id: row.id,
    at: row.at,
    by: row.by,
    clientId: row.client_id ?? "",
    clientName: row.client_name,
    target: row.target,
    before: row.before_text,
    after: row.after_text,
    reason: row.reason,
    snapshotBefore: row.snapshot_before,
    restored: row.restored,
  };
}

function summarize(c: Client | null): string {
  if (!c) return "（なし）";
  return [
    `会社名：${c.name}`,
    `ふりがな：${c.kana}`,
    `電話：${c.phone}`,
    `FAX：${c.fax}`,
    `担当者：${c.contact}`,
    `住所：${c.address}`,
    `配送会社：${c.carrier}`,
    `直送先：${c.directShip}`,
    `状態：${c.status === "active" ? "取引中" : "取引停止"}`,
  ].join(" / ");
}

export function describeChange(before: Client | null, after: Client, scope: string): { before: string; after: string } {
  if (scope === "rules") {
    const fmt = (c: Client | null) =>
      c ? c.rules.map((r) => `[${r.category}]${r.important ? "★" : ""}${r.text}`).join("\n") || "（ルールなし）" : "（なし）";
    return { before: fmt(before), after: fmt(after) };
  }
  if (scope === "products") {
    const fmt = (c: Client | null) =>
      c
        ? c.products.map((p) => `${p.name}（${p.alias || "呼び方なし"}／${p.weight}／${p.spec}）`).join("\n") || "（商品なし）"
        : "（なし）";
    return { before: fmt(before), after: fmt(after) };
  }
  return { before: summarize(before), after: summarize(after) };
}

type Store = {
  ready: boolean;
  loadError: string | null;
  clients: Client[];
  history: HistoryEntry[];
  recent: string[];
  editor: string;
  setEditor: (name: string) => void;
  touchRecent: (id: string) => void;
  /** 変更を保存し、変更履歴を残す */
  saveClient: (next: Client, target: string, reason: string) => Promise<void>;
  addClient: (c: Client) => Promise<void>;
  restore: (historyId: string) => Promise<void>;
  addLabel: (clientId: string, file: File, kind: LabelImage["kind"], title: string, note: string) => Promise<void>;
  deleteLabel: (label: LabelImage) => Promise<void>;
};

const Ctx = createContext<Store | null>(null);

export function useStore(): Store {
  const v = useContext(Ctx);
  if (!v) throw new Error("StoreProvider が必要です");
  return v;
}

// SupabaseのエラーはErrorのサブクラスではなく、{ message, code, ... } という普通のオブジェクトで返ることが多い
export function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === "object" && "message" in e && typeof (e as { message: unknown }).message === "string") {
    return (e as { message: string }).message;
  }
  return "通信に失敗しました。もう一度お試しください。";
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  const [editor, setEditorState] = useState("");

  /* eslint-disable react-hooks/set-state-in-effect -- SSR後にlocalStorage/Supabaseから初期読込する */
  useEffect(() => {
    try {
      setEditorState(localStorage.getItem(EDITOR_KEY) ?? "");
    } catch {
      // 読めなくても致命的ではない
    }
  }, []);

  const setEditor = useCallback((name: string) => {
    setEditorState(name);
    try {
      localStorage.setItem(EDITOR_KEY, name);
    } catch {
      // 保存できなくても続行
    }
  }, []);

  const refresh = useCallback(async () => {
    const [clientsRes, rulesRes, productsRes, labelsRes, historyRes, recentRes] = await Promise.all([
      supabase.from("clients").select("*").order("created_at", { ascending: true }),
      supabase.from("rules").select("*"),
      supabase.from("products").select("*"),
      supabase.from("labels").select("*"),
      supabase.from("history").select("*").order("at", { ascending: false }),
      supabase.from("recent_views").select("client_id, viewed_at").order("viewed_at", { ascending: false }).limit(200),
    ]);
    const firstError =
      clientsRes.error || rulesRes.error || productsRes.error || labelsRes.error || historyRes.error || recentRes.error;
    if (firstError) throw firstError;

    const rulesByClient = new Map<string, RuleRow[]>();
    (rulesRes.data as RuleRow[]).forEach((r) => rulesByClient.set(r.client_id, [...(rulesByClient.get(r.client_id) ?? []), r]));
    const productsByClient = new Map<string, ProductRow[]>();
    (productsRes.data as ProductRow[]).forEach((p) =>
      productsByClient.set(p.client_id, [...(productsByClient.get(p.client_id) ?? []), p]),
    );
    const labelsByClient = new Map<string, LabelRow[]>();
    (labelsRes.data as LabelRow[]).forEach((l) => labelsByClient.set(l.client_id, [...(labelsByClient.get(l.client_id) ?? []), l]));

    const nextClients = (clientsRes.data as ClientRow[]).map((row) =>
      toClient(row, rulesByClient.get(row.id) ?? [], productsByClient.get(row.id) ?? [], labelsByClient.get(row.id) ?? []),
    );
    const nextHistory = (historyRes.data as HistoryRow[]).map(toHistory);

    const seenRecent = new Set<string>();
    const nextRecent: string[] = [];
    for (const r of recentRes.data as { client_id: string }[]) {
      if (seenRecent.has(r.client_id)) continue;
      seenRecent.add(r.client_id);
      nextRecent.push(r.client_id);
      if (nextRecent.length >= RECENT_MAX) break;
    }

    setClients(nextClients);
    setHistory(nextHistory);
    setRecent(nextRecent);
  }, []);

  useEffect(() => {
    refresh()
      .catch((e) => setLoadError(errMsg(e)))
      .finally(() => setReady(true));
  }, [refresh]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const touchRecent = useCallback((id: string) => {
    supabase
      .from("recent_views")
      .insert({ client_id: id })
      .then(({ error }) => {
        if (error) return;
        setRecent((r) => [id, ...r.filter((x) => x !== id)].slice(0, RECENT_MAX));
      });
  }, []);

  const saveClientToDb = useCallback(async (c: Client) => {
    const { error } = await supabase.rpc("save_client_full", {
      p_id: c.id,
      p_name: c.name,
      p_kana: c.kana,
      p_phone: c.phone,
      p_fax: c.fax,
      p_contact: c.contact,
      p_address: c.address,
      p_carrier: c.carrier,
      p_direct_ship: c.directShip,
      p_note: c.note,
      p_status: c.status,
      p_rules: c.rules.map((r) => ({ category: r.category, text: r.text, important: r.important })),
      p_products: c.products.map((p) => ({ name: p.name, alias: p.alias, weight: p.weight, spec: p.spec })),
    });
    if (error) throw error;
  }, []);

  const pushHistory = useCallback(async (e: Omit<HistoryEntry, "id" | "at">) => {
    const { error } = await supabase.from("history").insert({
      by: e.by,
      client_id: e.clientId,
      client_name: e.clientName,
      target: e.target,
      before_text: e.before,
      after_text: e.after,
      reason: e.reason,
      snapshot_before: e.snapshotBefore,
    });
    if (error) throw error;
  }, []);

  const saveClient = useCallback(
    async (next: Client, target: string, reason: string) => {
      const prev = clients.find((c) => c.id === next.id) ?? null;
      const scope = target.startsWith("会社別ルール") ? "rules" : target.startsWith("商品情報") ? "products" : "info";
      const d = describeChange(prev, next, scope);
      await saveClientToDb(next);
      await pushHistory({
        by: editor || "未選択",
        clientId: next.id,
        clientName: next.name,
        target,
        before: d.before,
        after: d.after,
        reason,
        snapshotBefore: prev,
      });
      await refresh();
    },
    [clients, editor, saveClientToDb, pushHistory, refresh],
  );

  const addClient = useCallback(
    async (c: Client) => {
      await saveClientToDb(c);
      await pushHistory({
        by: editor || "未選択",
        clientId: c.id,
        clientName: c.name,
        target: "新規取引先登録",
        before: "（なし）",
        after: summarize(c),
        reason: "",
        snapshotBefore: null,
      });
      await refresh();
    },
    [editor, saveClientToDb, pushHistory, refresh],
  );

  const restore = useCallback(
    async (historyId: string) => {
      const { error } = await supabase.rpc("restore_client", { p_history_id: historyId, p_by: editor || "未選択" });
      if (error) throw error;
      await refresh();
    },
    [editor, refresh],
  );

  const addLabel = useCallback(
    async (clientId: string, file: File, kind: LabelImage["kind"], title: string, note: string) => {
      const path = `${clientId}/${uid()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from(LABEL_BUCKET).upload(path, file);
      if (upErr) throw upErr;
      const { error: insErr } = await supabase.from("labels").insert({ client_id: clientId, kind, title, storage_path: path, note });
      if (insErr) throw insErr;
      await refresh();
    },
    [refresh],
  );

  const deleteLabel = useCallback(
    async (label: LabelImage) => {
      await supabase.storage.from(LABEL_BUCKET).remove([label.path]);
      const { error } = await supabase.from("labels").delete().eq("id", label.id);
      if (error) throw error;
      await refresh();
    },
    [refresh],
  );

  const value = useMemo<Store>(
    () => ({
      ready,
      loadError,
      clients,
      history,
      recent,
      editor,
      setEditor,
      touchRecent,
      saveClient,
      addClient,
      restore,
      addLabel,
      deleteLabel,
    }),
    [ready, loadError, clients, history, recent, editor, setEditor, touchRecent, saveClient, addClient, restore, addLabel, deleteLabel],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
