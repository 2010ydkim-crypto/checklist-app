-- 체크리스트 앱용 테이블과 보안 규칙
-- Supabase 대시보드 → SQL Editor → New query 에 전체를 붙여넣고 Run 하세요.

create table if not exists public.checklist_items (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  text        text not null check (char_length(text) between 1 and 200),
  done        boolean not null default false,
  date        date not null default current_date,
  created_at  timestamptz not null default now()
);

create index if not exists checklist_items_user_date_idx
  on public.checklist_items (user_id, date);

-- 행 단위 보안(RLS): 로그인한 사용자는 자기 항목만 보고 고칠 수 있음
alter table public.checklist_items enable row level security;

drop policy if exists "own items: select" on public.checklist_items;
drop policy if exists "own items: insert" on public.checklist_items;
drop policy if exists "own items: update" on public.checklist_items;
drop policy if exists "own items: delete" on public.checklist_items;

create policy "own items: select" on public.checklist_items
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "own items: insert" on public.checklist_items
  for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "own items: update" on public.checklist_items
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "own items: delete" on public.checklist_items
  for delete to authenticated using ((select auth.uid()) = user_id);
