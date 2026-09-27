"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { groupByRow, searchClients } from "@/lib/search";

export default function Home() {
  const { clients, recent, ready } = useStore();
  const [q, setQ] = useState("");
  const [showSuspended, setShowSuspended] = useState(false);

  const hits = useMemo(() => searchClients(clients, q, showSuspended), [clients, q, showSuspended]);
  const recentClients = recent
    .map((id) => clients.find((c) => c.id === id))
    .filter((c): c is NonNullable<typeof c> => !!c && (showSuspended || c.status === "active"));
  const searching = q.trim().length > 0;
  const groups = useMemo(
    () => groupByRow(clients.filter((c) => showSuspended || c.status === "active")),
    [clients, showSuspended],
  );

  return (
    <div className="space-y-5">
      <div>
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="会社名、または「会社名 シール」「納品書 箱」など"
          className="w-full rounded-xl border-2 border-sky-600 bg-white px-4 py-3.5 text-lg outline-none focus:ring-4 focus:ring-sky-200"
          aria-label="取引先検索"
        />
        <label className="mt-2 flex w-fit cursor-pointer items-center gap-2 py-1 text-base text-slate-700">
          <input
            type="checkbox"
            checked={showSuspended}
            onChange={(e) => setShowSuspended(e.target.checked)}
            className="h-5 w-5"
          />
          取引停止も表示
        </label>
      </div>

      {searching ? (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-slate-500">検索結果 {hits.length}件</h2>
          {hits.length === 0 ? (
            <p className="rounded-xl bg-white p-6 text-center text-slate-500">該当する取引先がありません</p>
          ) : (
            <ul className="space-y-2">
              {hits.map(({ client, hint }) => (
                <li key={client.id}>
                  <Link
                    href={`/clients/${client.id}`}
                    className="block rounded-xl border border-slate-200 bg-white px-4 py-3 hover:border-sky-500 hover:bg-sky-50"
                  >
                    <div className="flex items-center gap-2 text-lg font-semibold">
                      {client.name}
                      {client.status === "suspended" && (
                        <span className="rounded bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600">取引停止</span>
                      )}
                    </div>
                    {hint && <div className="mt-0.5 text-sm text-slate-500">ルール一致：{hint}</div>}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : (
        <>
        <section>
          <h2 className="mb-2 text-sm font-semibold text-slate-500">最近見た会社</h2>
          {!ready ? null : recentClients.length === 0 ? (
            <p className="rounded-xl bg-white p-6 text-center text-slate-500">
              まだありません。上の検索欄から取引先を探してください。
            </p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {recentClients.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/clients/${c.id}`}
                    className="block rounded-xl border border-slate-200 bg-white px-4 py-3 text-lg font-medium hover:border-sky-500 hover:bg-sky-50"
                  >
                    {c.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold text-slate-500">会社一覧（あいうえお順）</h2>
          {groups.length > 1 && (
            <nav className="mb-3 flex flex-wrap gap-1" aria-label="行へジャンプ">
              {groups.map((g) => (
                <a
                  key={g.row}
                  href={`#row-${g.row}`}
                  className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 bg-white font-medium text-sky-800 hover:bg-sky-50"
                >
                  {g.row}
                </a>
              ))}
            </nav>
          )}
          <div className="space-y-4">
            {groups.map((g) => (
              <div key={g.row} id={`row-${g.row}`} className="scroll-mt-20">
                <div className="mb-1 border-b border-slate-300 pb-1 text-base font-bold text-slate-600">{g.row}行</div>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {g.clients.map((c) => (
                    <li key={c.id}>
                      <Link
                        href={`/clients/${c.id}`}
                        className="flex min-h-12 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-lg hover:border-sky-500 hover:bg-sky-50"
                      >
                        {c.name}
                        {c.status === "suspended" && (
                          <span className="rounded bg-slate-200 px-2 py-0.5 text-xs text-slate-600">取引停止</span>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
        </>
      )}
    </div>
  );
}
