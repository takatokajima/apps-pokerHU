-- HeadsUp Online: Supabase の SQL Editor で1回実行する
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  avatar text not null default 'spade',
  rating integer not null default 1500,
  is_guest boolean not null default true,
  games integer not null default 0,
  wins integer not null default 0,
  act integer not null default 1,
  updated_at timestamptz not null default now()
);

-- ランキング取得を速くする
create index if not exists profiles_leaderboard_idx
  on public.profiles (act, rating desc)
  where is_guest = false and games > 0;

-- ブラウザから直接は触らせない（サーバーの service_role キー経由のみ）
alter table public.profiles enable row level security;

-- ===== 2026-09-25 追加: 成績・ハンド履歴・試合記録 =====
alter table public.profiles add column if not exists x_handle text;
alter table public.profiles add column if not exists stats jsonb not null default '{}'::jsonb;

create table if not exists public.matches (
  id uuid primary key,
  mode text not null,
  at timestamptz not null default now(),
  p0 text not null,
  p1 text not null,
  data jsonb not null
);
create index if not exists matches_p0_idx on public.matches (p0, at desc);
create index if not exists matches_p1_idx on public.matches (p1, at desc);
create index if not exists matches_ranked_at_idx on public.matches (at) where mode = 'ranked';
alter table public.matches enable row level security;

create table if not exists public.hands (
  id uuid primary key,
  match_id uuid not null,
  at timestamptz not null default now(),
  p0 text not null,
  p1 text not null,
  data jsonb not null
);
create index if not exists hands_match_idx on public.hands (match_id, at);
create index if not exists hands_p0_idx on public.hands (p0, at desc);
create index if not exists hands_p1_idx on public.hands (p1, at desc);
alter table public.hands enable row level security;
