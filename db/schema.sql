-- TriTrack — Supabase şeması (kullanıcı başına tek satır JSON state)
-- Supabase paneli → SQL Editor'a yapıştırıp çalıştır.

create table if not exists public.user_data (
  user_id    uuid primary key references auth.users on delete cascade,
  data       jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

-- Satır Bazlı Güvenlik: her kullanıcı yalnız kendi satırını görür/yazar
alter table public.user_data enable row level security;

drop policy if exists "sel own" on public.user_data;
drop policy if exists "ins own" on public.user_data;
drop policy if exists "upd own" on public.user_data;

create policy "sel own" on public.user_data
  for select using (auth.uid() = user_id);

create policy "ins own" on public.user_data
  for insert with check (auth.uid() = user_id);

create policy "upd own" on public.user_data
  for update using (auth.uid() = user_id);
