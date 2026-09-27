"use client";

import { useState } from "react";
import type { Client } from "@/lib/types";
import { btnGhost, btnPrimary, inputCls } from "./ui";

export type InfoValues = Pick<
  Client,
  "name" | "kana" | "phone" | "fax" | "contact" | "address" | "carrier" | "directShip" | "note"
>;

export const EMPTY_INFO: InfoValues = {
  name: "", kana: "", phone: "", fax: "", contact: "", address: "", carrier: "", directShip: "", note: "",
};

const FIELDS: { key: keyof InfoValues; label: string; required?: boolean; multiline?: boolean }[] = [
  { key: "name", label: "会社名", required: true },
  { key: "kana", label: "ふりがな（一覧の並び順に使います）" },
  { key: "phone", label: "電話番号", required: true },
  { key: "fax", label: "FAX番号" },
  { key: "contact", label: "担当者名" },
  { key: "address", label: "住所", required: true },
  { key: "carrier", label: "配送会社" },
  { key: "directShip", label: "直送先" },
  { key: "note", label: "その他必要情報", multiline: true },
];

export function ClientForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: InfoValues;
  submitLabel: string;
  onSubmit: (v: InfoValues) => void;
  onCancel: () => void;
}) {
  const [v, setV] = useState<InfoValues>(initial);
  const [tried, setTried] = useState(false);
  const missing = FIELDS.filter((f) => f.required && !v[f.key].trim());

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        setTried(true);
        if (missing.length === 0) onSubmit(v);
      }}
    >
      {FIELDS.map((f) => {
        const err = tried && f.required && !v[f.key].trim();
        return (
          <div key={f.key}>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              {f.label}
              {f.required && <span className="ml-1 text-red-600">必須</span>}
            </label>
            {f.multiline ? (
              <textarea rows={3} className={inputCls} value={v[f.key]} onChange={(e) => setV({ ...v, [f.key]: e.target.value })} />
            ) : (
              <input
                className={inputCls + (err ? " border-red-500" : "")}
                value={v[f.key]}
                onChange={(e) => setV({ ...v, [f.key]: e.target.value })}
              />
            )}
            {err && <p className="mt-1 text-sm text-red-600">{f.label}を入力してください</p>}
          </div>
        );
      })}
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className={btnGhost} onClick={onCancel}>キャンセル</button>
        <button type="submit" className={btnPrimary}>{submitLabel}</button>
      </div>
    </form>
  );
}
