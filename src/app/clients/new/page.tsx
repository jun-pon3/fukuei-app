"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ClientForm, EMPTY_INFO, type InfoValues } from "@/components/ClientForm";
import { ConfirmSave, useRequireEditor } from "@/components/ui";
import { useStore } from "@/lib/store";
import { newClientId } from "@/lib/types";

export default function NewClientPage() {
  const router = useRouter();
  const { addClient } = useStore();
  const { run, dialog } = useRequireEditor();
  const [draft, setDraft] = useState<InfoValues | null>(null);

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-4 text-xl font-bold">新規取引先登録</h1>
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <ClientForm
          initial={EMPTY_INFO}
          submitLabel="登録する"
          onCancel={() => router.push("/")}
          onSubmit={(v) => run(() => setDraft(v))}
        />
      </div>
      {dialog}
      {draft && (
        <ConfirmSave
          onCancel={() => setDraft(null)}
          onConfirm={async () => {
            const id = newClientId();
            await addClient({
              ...draft,
              id,
              status: "active",
              products: [],
              rules: [],
              labels: [],
              updatedAt: new Date().toISOString(),
            });
            router.push(`/clients/${id}`);
          }}
        />
      )}
    </div>
  );
}
