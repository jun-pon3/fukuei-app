"use client";

import { useState } from "react";
import { btnGhost, fmtDate, Modal, btnPrimary, useRequireEditor } from "@/components/ui";
import { errMsg, useStore } from "@/lib/store";

export default function HistoryPage() {
  const { history, restore } = useStore();
  const { run, dialog } = useRequireEditor();
  const [target, setTarget] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRestore() {
    if (!target) return;
    setBusy(true);
    setError(null);
    try {
      await restore(target);
      setTarget(null);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1 className="mb-1 text-xl font-bold">変更履歴</h1>
      <p className="mb-4 text-sm text-slate-600">
        「元に戻す」で、その変更を行う前の状態に復元できます（復元も履歴に残ります）。
      </p>
      {history.length === 0 ? (
        <p className="rounded-xl bg-white p-6 text-center text-slate-500">まだ変更はありません</p>
      ) : (
        <ul className="space-y-3">
          {history.map((h) => (
            <li key={h.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="font-semibold">{h.clientName}</span>
                <span className="rounded bg-sky-100 px-2 py-0.5 text-xs text-sky-800">{h.target}</span>
                <span className="text-sm text-slate-500">{fmtDate(h.at)}／{h.by}</span>
              </div>
              {h.reason && <p className="mt-1 text-sm text-slate-600">理由：{h.reason}</p>}
              <details className="mt-2">
                <summary className="cursor-pointer py-1 text-sm text-sky-700">変更前・変更後を見る</summary>
                <div className="mt-2 grid gap-2 md:grid-cols-2">
                  <pre className="whitespace-pre-wrap rounded-lg bg-red-50 p-3 text-sm">
                    <b className="block text-red-700">変更前</b>{h.before}
                  </pre>
                  <pre className="whitespace-pre-wrap rounded-lg bg-green-50 p-3 text-sm">
                    <b className="block text-green-700">変更後</b>{h.after}
                  </pre>
                </div>
              </details>
              <div className="mt-2">
                {h.restored ? (
                  <span className="text-sm text-slate-500">復元済み</span>
                ) : (
                  <button className={btnGhost} onClick={() => run(() => setTarget(h.id))}>元に戻す</button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {dialog}
      {target && (
        <Modal title="この変更を元に戻しますか？" onClose={busy ? () => {} : () => setTarget(null)}>
          <p className="text-sm text-slate-600">この変更より前の状態に復元します。</p>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          <div className="mt-5 flex justify-end gap-2">
            <button className={btnGhost} onClick={() => setTarget(null)} disabled={busy}>やめる</button>
            <button className={btnPrimary} onClick={handleRestore} disabled={busy}>
              {busy ? "復元中…" : "元に戻す"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
