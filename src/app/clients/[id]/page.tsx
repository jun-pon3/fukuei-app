"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ClientForm } from "@/components/ClientForm";
import { btnGhost, btnPrimary, ConfirmSave, inputCls, Modal, useRequireEditor } from "@/components/ui";
import { clientToCsv, downloadCsv } from "@/lib/csv";
import { errMsg, useStore } from "@/lib/store";
import { RULE_CATEGORIES, uid, type Client, type LabelImage, type Product, type Rule } from "@/lib/types";

type Pending = { client: Client; target: string };

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const { clients, ready, touchRecent, saveClient, addLabel, deleteLabel } = useStore();
  const client = clients.find((c) => c.id === id);
  const { run, dialog } = useRequireEditor();

  const [editInfo, setEditInfo] = useState(false);
  const [editCat, setEditCat] = useState<string | null>(null);
  const [editProducts, setEditProducts] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const [zoom, setZoom] = useState<LabelImage | null>(null);
  const [addingLabel, setAddingLabel] = useState(false);
  const [labelBusy, setLabelBusy] = useState(false);
  const [labelError, setLabelError] = useState<string | null>(null);

  const clientId = client?.id;
  useEffect(() => {
    if (ready && clientId) touchRecent(clientId);
  }, [ready, clientId, touchRecent]);

  if (!ready) return null;
  if (!client) {
    return (
      <div className="rounded-xl bg-white p-6 text-center">
        取引先が見つかりません。<Link href="/" className="text-sky-700 underline">検索に戻る</Link>
      </div>
    );
  }

  const suspended = client.status === "suspended";
  // 定義済みカテゴリに加え、追加されたカテゴリがあればそれも表示する
  const extra = [...new Set(client.rules.map((r) => r.category))].filter(
    (c) => !(RULE_CATEGORIES as readonly string[]).includes(c),
  );
  const categories: string[] = [...RULE_CATEGORIES, ...extra];

  return (
    <div className="space-y-5">
      <div>
        <Link href="/" className="text-sky-700 underline">← 検索へ</Link>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{client.name}</h1>
          {suspended && (
            <span className="mt-1 inline-block rounded bg-slate-200 px-2 py-0.5 text-sm text-slate-700">取引停止中</span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className={btnGhost}
            onClick={() => downloadCsv(`${client.name}.csv`, clientToCsv(client))}
            title="基本情報・会社別ルール・商品情報をCSVで保存します"
          >
            CSV書き出し
          </button>
          <button className={btnGhost} onClick={() => run(() => setEditInfo(true))}>基本情報を編集</button>
          <button
            className={btnGhost}
            onClick={() =>
              run(() =>
                setPending({
                  client: { ...client, status: suspended ? "active" : "suspended" },
                  target: suspended ? "取引再開" : "取引停止",
                }),
              )
            }
          >
            {suspended ? "取引を再開" : "取引停止にする"}
          </button>
        </div>
      </div>

      <Card title="基本情報">
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          <Info label="電話番号" value={client.phone} />
          <Info label="FAX番号" value={client.fax} />
          <Info label="担当者名" value={client.contact} />
          <Info label="配送会社" value={client.carrier} />
          <Info label="住所" value={client.address} wide />
          <Info label="直送先" value={client.directShip} wide />
          <Info label="その他" value={client.note} wide />
        </dl>
      </Card>

      <Card
        title="商品情報"
        action={
          <button className="rounded-lg px-3 py-2 text-sky-700 hover:bg-sky-50" onClick={() => run(() => setEditProducts(true))}>
            ［編集］
          </button>
        }
      >
        {client.products.length === 0 ? (
          <Empty />
        ) : (
          <>
            <table className="hidden w-full text-left md:table">
              <thead className="border-b text-sm text-slate-500">
                <tr><th className="py-2">商品名</th><th>取引先での呼び方</th><th>重量</th><th>規格</th></tr>
              </thead>
              <tbody>
                {client.products.map((p) => (
                  <tr key={p.id} className="border-b last:border-0">
                    <td className="py-2 font-medium">{p.name}</td>
                    <td>{p.alias}</td>
                    <td>{p.weight}</td>
                    <td>{p.spec}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <ul className="space-y-2 md:hidden">
              {client.products.map((p) => (
                <li key={p.id} className="rounded-lg border border-slate-200 p-3">
                  <div className="font-semibold">{p.name}</div>
                  <div className="mt-1 text-sm text-slate-600">呼び方：{p.alias || "－"}</div>
                  <div className="text-sm text-slate-600">重量：{p.weight || "－"}／規格：{p.spec || "－"}</div>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      <div className="space-y-3">
        <h2 className="text-lg font-bold">会社別ルール</h2>
        {categories.map((cat) => {
          const rules = client.rules.filter((r) => r.category === cat);
          return (
            <Card
              key={cat}
              title={cat}
              action={
                <button className="rounded-lg px-3 py-2 text-sky-700 hover:bg-sky-50" onClick={() => run(() => setEditCat(cat))}>
                  ［編集］
                </button>
              }
            >
              {rules.length === 0 ? (
                <Empty />
              ) : (
                <ul className="space-y-2">
                  {rules.map((r) => (
                    <li
                      key={r.id}
                      className={
                        r.important
                          ? "flex gap-2 rounded-lg border-l-4 border-red-600 bg-red-50 px-3 py-2 font-bold text-red-900"
                          : "px-3 py-1"
                      }
                    >
                      {r.important && (
                        <span className="h-6 shrink-0 rounded bg-red-600 px-1.5 text-sm leading-6 text-white">⚠ 重要</span>
                      )}
                      <span>{r.text}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          );
        })}
      </div>

      <Card
        title="ラベル・シール見本"
        action={
          <button className="rounded-lg px-3 py-2 text-sky-700 hover:bg-sky-50" onClick={() => run(() => setAddingLabel(true))}>
            ＋ 画像を追加
          </button>
        }
      >
        {client.labels.length === 0 ? (
          <Empty />
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {client.labels.map((l) => (
              <li key={l.id}>
                <button onClick={() => setZoom(l)} className="block w-full text-left">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={l.src} alt={l.title} className="w-full rounded-lg border border-slate-200" />
                  <div className="mt-1 text-sm font-medium">{l.title}</div>
                  <div className="text-xs text-slate-500">{l.kind}</div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {dialog}

      {editInfo && (
        <Modal title="基本情報を編集" onClose={() => setEditInfo(false)}>
          <ClientForm
            initial={client}
            submitLabel="保存へ進む"
            onCancel={() => setEditInfo(false)}
            onSubmit={(v) => {
              setEditInfo(false);
              setPending({ client: { ...client, ...v }, target: "基本情報" });
            }}
          />
        </Modal>
      )}

      {editCat && (
        <RuleEditor
          category={editCat}
          rules={client.rules.filter((r) => r.category === editCat)}
          onCancel={() => setEditCat(null)}
          onSubmit={(rules) => {
            const others = client.rules.filter((r) => r.category !== editCat);
            setPending({ client: { ...client, rules: [...others, ...rules] }, target: `会社別ルール（${editCat}）` });
            setEditCat(null);
          }}
        />
      )}

      {editProducts && (
        <ProductEditor
          products={client.products}
          onCancel={() => setEditProducts(false)}
          onSubmit={(products) => {
            setPending({ client: { ...client, products }, target: "商品情報" });
            setEditProducts(false);
          }}
        />
      )}

      {pending && (
        <ConfirmSave
          onCancel={() => setPending(null)}
          onConfirm={async (reason) => {
            await saveClient(pending.client, pending.target, reason);
            setPending(null);
          }}
        />
      )}

      {addingLabel && (
        <LabelForm
          onCancel={() => setAddingLabel(false)}
          onSubmit={async (file, kind, title, note) => {
            setLabelBusy(true);
            setLabelError(null);
            try {
              await addLabel(client.id, file, kind, title, note);
              setAddingLabel(false);
            } catch (e) {
              setLabelError(errMsg(e));
            } finally {
              setLabelBusy(false);
            }
          }}
          busy={labelBusy}
          error={labelError}
        />
      )}

      {zoom && (
        <Modal title={zoom.title} onClose={() => setZoom(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={zoom.src} alt={zoom.title} className="w-full rounded-lg border" />
          {zoom.note && <p className="mt-2 text-sm">{zoom.note}</p>}
          {labelError && <p className="mt-2 text-sm text-red-600">{labelError}</p>}
          <div className="mt-4 flex justify-between">
            <button
              className="rounded-lg px-3 py-2 text-red-700 hover:bg-red-50 disabled:opacity-50"
              disabled={labelBusy}
              onClick={() =>
                run(async () => {
                  if (!window.confirm("この画像を削除しますか？")) return;
                  setLabelBusy(true);
                  setLabelError(null);
                  try {
                    await deleteLabel(zoom);
                    setZoom(null);
                  } catch (e) {
                    setLabelError(errMsg(e));
                  } finally {
                    setLabelBusy(false);
                  }
                })
              }
            >
              削除
            </button>
            <button className={btnGhost} onClick={() => setZoom(null)}>閉じる</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Card({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-bold">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function Empty() {
  return <p className="px-3 text-slate-400">登録なし</p>;
}

function Info({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="whitespace-pre-wrap text-base">{value || "－"}</dd>
    </div>
  );
}

const LABEL_KINDS: LabelImage["kind"][] = ["商品ラベル", "外箱ラベル", "その他"];

function LabelForm({
  onCancel,
  onSubmit,
  busy,
  error,
}: {
  onCancel: () => void;
  onSubmit: (file: File, kind: LabelImage["kind"], title: string, note: string) => void;
  busy: boolean;
  error: string | null;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [kind, setKind] = useState<LabelImage["kind"]>("商品ラベル");
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [tried, setTried] = useState(false);

  return (
    <Modal title="ラベル画像を追加" onClose={busy ? () => {} : onCancel}>
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            画像ファイル<span className="ml-1 text-red-600">必須</span>
          </label>
          <input
            type="file"
            accept="image/*"
            className={inputCls}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            disabled={busy}
          />
          {tried && !file && <p className="mt-1 text-sm text-red-600">画像を選んでください</p>}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">種類</label>
          <select className={inputCls} value={kind} onChange={(e) => setKind(e.target.value as LabelImage["kind"])} disabled={busy}>
            {LABEL_KINDS.map((k) => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">タイトル</label>
          <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} disabled={busy} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">注意事項（任意）</label>
          <textarea rows={2} className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} disabled={busy} />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button className={btnGhost} onClick={onCancel} disabled={busy}>キャンセル</button>
        <button
          className={btnPrimary}
          disabled={busy}
          onClick={() => {
            setTried(true);
            if (file) onSubmit(file, kind, title.trim(), note.trim());
          }}
        >
          {busy ? "アップロード中…" : "アップロード"}
        </button>
      </div>
    </Modal>
  );
}

function ProductEditor({
  products,
  onCancel,
  onSubmit,
}: {
  products: Product[];
  onCancel: () => void;
  onSubmit: (products: Product[]) => void;
}) {
  const [list, setList] = useState<Product[]>(products);
  const [tried, setTried] = useState(false);
  const update = (id: string, patch: Partial<Product>) =>
    setList((l) => l.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  const hasBlankName = list.some((p) => !p.name.trim());

  return (
    <Modal title="商品情報を編集" onClose={onCancel}>
      <ul className="space-y-3">
        {list.map((p) => (
          <li key={p.id} className="space-y-2 rounded-lg border border-slate-200 p-3">
            <div>
              <label className="mb-1 block text-sm text-slate-600">
                商品名<span className="ml-1 text-red-600">必須</span>
              </label>
              <input
                className={inputCls + (tried && !p.name.trim() ? " border-red-500" : "")}
                value={p.name}
                onChange={(e) => update(p.id, { name: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-600">取引先での呼び方</label>
              <input className={inputCls} value={p.alias} onChange={(e) => update(p.id, { alias: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-sm text-slate-600">重量</label>
                <input className={inputCls} value={p.weight} onChange={(e) => update(p.id, { weight: e.target.value })} />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-600">規格</label>
                <input className={inputCls} value={p.spec} onChange={(e) => update(p.id, { spec: e.target.value })} />
              </div>
            </div>
            <div className="text-right">
              <button
                className="rounded-lg px-3 py-2 text-red-700 hover:bg-red-50"
                onClick={() => setList((l) => l.filter((x) => x.id !== p.id))}
              >
                削除
              </button>
            </div>
          </li>
        ))}
      </ul>
      <button
        className={btnGhost + " mt-3 w-full"}
        onClick={() => setList((l) => [...l, { id: uid(), name: "", alias: "", weight: "", spec: "" }])}
      >
        ＋ 商品を追加
      </button>
      {tried && hasBlankName && <p className="mt-2 text-sm text-red-600">商品名が空のものがあります</p>}
      <div className="mt-5 flex justify-end gap-2">
        <button className={btnGhost} onClick={onCancel}>キャンセル</button>
        <button
          className={btnPrimary}
          onClick={() => {
            setTried(true);
            if (!hasBlankName) onSubmit(list.map((p) => ({ ...p, name: p.name.trim() })));
          }}
        >
          保存へ進む
        </button>
      </div>
    </Modal>
  );
}

function RuleEditor({
  category,
  rules,
  onCancel,
  onSubmit,
}: {
  category: string;
  rules: Rule[];
  onCancel: () => void;
  onSubmit: (rules: Rule[]) => void;
}) {
  const [list, setList] = useState<Rule[]>(rules);
  const [tried, setTried] = useState(false);
  const update = (id: string, patch: Partial<Rule>) =>
    setList((l) => l.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const hasBlank = list.some((r) => !r.text.trim());

  return (
    <Modal title={`${category} を編集`} onClose={onCancel}>
      <ul className="space-y-3">
        {list.map((r) => (
          <li key={r.id} className="rounded-lg border border-slate-200 p-3">
            <textarea
              rows={2}
              className={inputCls + (tried && !r.text.trim() ? " border-red-500" : "")}
              value={r.text}
              onChange={(e) => update(r.id, { text: e.target.value })}
              placeholder="ルール内容"
            />
            <div className="mt-2 flex items-center justify-between">
              <label className="flex cursor-pointer items-center gap-2 py-1">
                <input
                  type="checkbox"
                  className="h-5 w-5"
                  checked={r.important}
                  onChange={(e) => update(r.id, { important: e.target.checked })}
                />
                重要
              </label>
              <button
                className="rounded-lg px-3 py-2 text-red-700 hover:bg-red-50"
                onClick={() => setList((l) => l.filter((x) => x.id !== r.id))}
              >
                削除
              </button>
            </div>
          </li>
        ))}
      </ul>
      <button
        className={btnGhost + " mt-3 w-full"}
        onClick={() => setList((l) => [...l, { id: uid(), category, text: "", important: false }])}
      >
        ＋ ルールを追加
      </button>
      {tried && hasBlank && <p className="mt-2 text-sm text-red-600">ルール内容が空のものがあります</p>}
      <div className="mt-5 flex justify-end gap-2">
        <button className={btnGhost} onClick={onCancel}>キャンセル</button>
        <button
          className={btnPrimary}
          onClick={() => {
            setTried(true);
            if (!hasBlank) onSubmit(list.map((r) => ({ ...r, text: r.text.trim() })));
          }}
        >
          保存へ進む
        </button>
      </div>
    </Modal>
  );
}
