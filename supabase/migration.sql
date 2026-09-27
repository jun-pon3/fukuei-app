-- 福栄 取引先データ管理アプリ：初期スキーマ
-- Supabaseダッシュボードの「SQL Editor」に貼り付けて実行してください。
-- 何度実行しても壊れないように書いています（すでにある場合はスキップされます）。

create extension if not exists pgcrypto;

-- ============================================================
-- テーブル
-- ============================================================

-- 取引先（基本情報）
create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kana text not null default '',
  phone text not null default '',
  fax text not null default '',
  contact text not null default '',
  address text not null default '',
  carrier text not null default '',
  direct_ship text not null default '',
  note text not null default '',
  status text not null default 'active' check (status in ('active', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 会社別ルール
create table if not exists rules (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  category text not null,
  text text not null,
  important boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists rules_client_id_idx on rules(client_id);

-- 商品情報（表示のみ。登録・編集はSupabaseのテーブルエディタから行う運用）
create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  name text not null default '',
  alias text not null default '',
  weight text not null default '',
  spec text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists products_client_id_idx on products(client_id);

-- ラベル・シール画像
create table if not exists labels (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  kind text not null default 'その他' check (kind in ('商品ラベル', '外箱ラベル', 'その他')),
  title text not null default '',
  storage_path text not null,
  note text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists labels_client_id_idx on labels(client_id);

-- 変更履歴（復元用に変更前の会社全体をJSONで保存する）
create table if not exists history (
  id uuid primary key default gen_random_uuid(),
  at timestamptz not null default now(),
  by text not null default '',
  client_id uuid references clients(id) on delete set null,
  client_name text not null default '',
  target text not null default '',
  before_text text not null default '',
  after_text text not null default '',
  reason text not null default '',
  snapshot_before jsonb,
  restored boolean not null default false
);
create index if not exists history_client_id_idx on history(client_id);
create index if not exists history_at_idx on history(at desc);

-- 最近見た会社（全員共通で表示するため、誰が見てもここに1行追加する）
create table if not exists recent_views (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  viewed_at timestamptz not null default now()
);
create index if not exists recent_views_client_id_idx on recent_views(client_id);
create index if not exists recent_views_viewed_at_idx on recent_views(viewed_at desc);

-- ============================================================
-- 関数（基本情報・ルール・商品情報をまとめて保存／復元する）
-- ============================================================

create or replace function save_client_full(
  p_id uuid,
  p_name text,
  p_kana text,
  p_phone text,
  p_fax text,
  p_contact text,
  p_address text,
  p_carrier text,
  p_direct_ship text,
  p_note text,
  p_status text,
  p_rules jsonb,
  p_products jsonb
) returns void
language plpgsql
as $$
begin
  insert into clients (id, name, kana, phone, fax, contact, address, carrier, direct_ship, note, status, updated_at)
  values (p_id, p_name, p_kana, p_phone, p_fax, p_contact, p_address, p_carrier, p_direct_ship, p_note, p_status, now())
  on conflict (id) do update set
    name = excluded.name,
    kana = excluded.kana,
    phone = excluded.phone,
    fax = excluded.fax,
    contact = excluded.contact,
    address = excluded.address,
    carrier = excluded.carrier,
    direct_ship = excluded.direct_ship,
    note = excluded.note,
    status = excluded.status,
    updated_at = now();

  delete from rules where client_id = p_id;
  insert into rules (client_id, category, text, important)
  select p_id, r->>'category', r->>'text', coalesce((r->>'important')::boolean, false)
  from jsonb_array_elements(coalesce(p_rules, '[]'::jsonb)) as r;

  delete from products where client_id = p_id;
  insert into products (client_id, name, alias, weight, spec)
  select p_id, r->>'name', r->>'alias', r->>'weight', r->>'spec'
  from jsonb_array_elements(coalesce(p_products, '[]'::jsonb)) as r;
end;
$$;

create or replace function restore_client(p_history_id uuid, p_by text)
returns void
language plpgsql
as $$
declare
  h record;
  snap jsonb;
  target_id uuid;
begin
  select * into h from history where id = p_history_id;
  if not found then
    raise exception '変更履歴が見つかりません: %', p_history_id;
  end if;

  snap := h.snapshot_before;

  if snap is null then
    -- 新規登録の取り消し：完全削除ではなく取引停止にする
    update clients set status = 'suspended', updated_at = now() where id = h.client_id;
    target_id := h.client_id;
  else
    target_id := (snap->>'id')::uuid;
    perform save_client_full(
      target_id,
      snap->>'name', snap->>'kana', snap->>'phone', snap->>'fax', snap->>'contact',
      snap->>'address', snap->>'carrier', snap->>'directShip', snap->>'note', snap->>'status',
      coalesce(snap->'rules', '[]'::jsonb),
      coalesce(snap->'products', '[]'::jsonb)
    );
  end if;

  update history set restored = true where id = p_history_id;

  insert into history (by, client_id, client_name, target, before_text, after_text, reason, snapshot_before)
  values (p_by, target_id, h.client_name, '復元（' || h.target || '）', '', '', '変更履歴からの復元', null);
end;
$$;

grant execute on function save_client_full(uuid,text,text,text,text,text,text,text,text,text,text,jsonb,jsonb) to anon, authenticated;
grant execute on function restore_client(uuid, text) to anon, authenticated;

-- ============================================================
-- アクセス権限（今回はログイン機能なしのため、anon（未ログイン）に全許可する）
-- 注意：この設定は「URLとキーを知っていれば誰でも読み書きできる」ことを意味します。
-- 将来ログイン機能を追加する際は、ここを見直してください。
-- ============================================================

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to anon, authenticated;

alter table clients enable row level security;
alter table rules enable row level security;
alter table products enable row level security;
alter table labels enable row level security;
alter table history enable row level security;
alter table recent_views enable row level security;

drop policy if exists "anon full access" on clients;
create policy "anon full access" on clients for all to anon, authenticated using (true) with check (true);

drop policy if exists "anon full access" on rules;
create policy "anon full access" on rules for all to anon, authenticated using (true) with check (true);

drop policy if exists "anon full access" on products;
create policy "anon full access" on products for all to anon, authenticated using (true) with check (true);

drop policy if exists "anon full access" on labels;
create policy "anon full access" on labels for all to anon, authenticated using (true) with check (true);

drop policy if exists "anon full access" on history;
create policy "anon full access" on history for all to anon, authenticated using (true) with check (true);

drop policy if exists "anon full access" on recent_views;
create policy "anon full access" on recent_views for all to anon, authenticated using (true) with check (true);

-- ============================================================
-- 画像保存用のStorageバケット（商品ラベル・外箱ラベルの画像）
-- ============================================================

insert into storage.buckets (id, name, public)
values ('labels', 'labels', true)
on conflict (id) do nothing;

drop policy if exists "labels public read" on storage.objects;
create policy "labels public read" on storage.objects for select to public using (bucket_id = 'labels');

drop policy if exists "labels anon upload" on storage.objects;
create policy "labels anon upload" on storage.objects for insert to anon, authenticated with check (bucket_id = 'labels');

drop policy if exists "labels anon update" on storage.objects;
create policy "labels anon update" on storage.objects for update to anon, authenticated using (bucket_id = 'labels');

drop policy if exists "labels anon delete" on storage.objects;
create policy "labels anon delete" on storage.objects for delete to anon, authenticated using (bucket_id = 'labels');
