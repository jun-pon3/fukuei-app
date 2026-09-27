"use client";

import Link from "next/link";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { EditorPicker } from "./ui";

export function Header() {
  const { editor, loadError } = useStore();
  const [picking, setPicking] = useState(false);
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2">
        <Link href="/" className="text-lg font-bold text-sky-800">福栄 取引先管理</Link>
        <nav className="flex basis-full items-center gap-1 whitespace-nowrap text-base sm:basis-auto sm:flex-1">
          <Link href="/" className="rounded-lg px-3 py-2 hover:bg-slate-100">検索</Link>
          <Link href="/clients/new" className="rounded-lg px-3 py-2 hover:bg-slate-100">新規登録</Link>
          <Link href="/history" className="rounded-lg px-3 py-2 hover:bg-slate-100">変更履歴</Link>
        </nav>
        <button
          onClick={() => setPicking(true)}
          className="ml-auto rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
        >
          担当者：<b>{editor || "未選択"}</b>
        </button>
      </div>
      {loadError && (
        <div className="bg-red-50 px-4 py-2 text-sm text-red-700">
          データの読み込みに失敗しました：{loadError}
        </div>
      )}
      {picking && <EditorPicker onDone={() => setPicking(false)} onCancel={() => setPicking(false)} />}
    </header>
  );
}
