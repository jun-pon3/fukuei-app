import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // .env.local の設定漏れに気づけるように、開発中はコンソールに出す
  console.error(
    "Supabaseの接続情報が設定されていません。.env.local に NEXT_PUBLIC_SUPABASE_URL と NEXT_PUBLIC_SUPABASE_ANON_KEY を設定してください。",
  );
}

export const supabase = createClient(url ?? "", anonKey ?? "");

export const LABEL_BUCKET = "labels";

export function labelPublicUrl(storagePath: string): string {
  return supabase.storage.from(LABEL_BUCKET).getPublicUrl(storagePath).data.publicUrl;
}
