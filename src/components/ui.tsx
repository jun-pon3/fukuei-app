"use client";

import { useState } from "react";
import { STAFF } from "@/lib/types";
import { errMsg, useStore } from "@/lib/store";

export const inputCls =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-200";

export const btnPrimary =
  "inline-flex min-h-11 items-center justify-center rounded-lg bg-sky-700 px-4 py-2 text-base font-semibold text-white hover:bg-sky-800 disabled:opacity-50";
export const btnGhost =
  "inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-base font-medium text-slate-700 hover:bg-slate-50";

export function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-3 text-lg font-bold">{title}</h2>
        {children}
      </div>
    </div>
  );
}

/** 保存前の確認ダイアログ（変更理由は任意）。保存はSupabaseへの通信のため、完了・失敗を画面に出す */
export function ConfirmSave({ onConfirm, onCancel }: { onConfirm: (reason: string) => Promise<void>; onCancel: () => void }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setBusy(true);
    setError(null);
    try {
      await onConfirm(reason.trim());
    } catch (e) {
      setError(errMsg(e));
      setBusy(false);
    }
  }

  return (
    <Modal title="本当に保存しますか？" onClose={busy ? () => {} : onCancel}>
      <label className="mb-1 block text-sm text-slate-600">変更理由（任意）</label>
      <input
        className={inputCls}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="例：先方から連絡があったため"
        disabled={busy}
      />
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <div className="mt-5 flex justify-end gap-2">
        <button className={btnGhost} onClick={onCancel} disabled={busy}>戻る</button>
        <button className={btnPrimary} onClick={handleConfirm} disabled={busy}>
          {busy ? "保存中…" : "保存する"}
        </button>
      </div>
    </Modal>
  );
}

/** 編集者（担当者名）の選択。未選択なら編集を始められない */
export function EditorPicker({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const { setEditor } = useStore();
  return (
    <Modal title="担当者を選んでください" onClose={onCancel}>
      <p className="mb-3 text-sm text-slate-600">変更履歴に記録されます。</p>
      <div className="grid gap-2">
        {STAFF.map((s) => (
          <button
            key={s}
            className={btnGhost + " justify-start text-lg"}
            onClick={() => {
              setEditor(s);
              onDone();
            }}
          >
            {s}
          </button>
        ))}
      </div>
      <div className="mt-4 text-right">
        <button className={btnGhost} onClick={onCancel}>キャンセル</button>
      </div>
    </Modal>
  );
}

/** 編集開始時に担当者が未選択なら選択を促すためのフック */
export function useRequireEditor() {
  const { editor } = useStore();
  const [pending, setPending] = useState<null | (() => void)>(null);
  const run = (fn: () => void) => {
    if (editor) fn();
    else setPending(() => fn);
  };
  const dialog = pending ? (
    <EditorPicker
      onDone={() => {
        const f = pending;
        setPending(null);
        f();
      }}
      onCancel={() => setPending(null)}
    />
  ) : null;
  return { run, dialog };
}

export function fmtDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
