-- 체크리스트 앱용 테이블과 보안 규칙
-- Supabase 대시보드 → SQL Editor → New query 에 전체를 붙여넣고 Run 하세요.
-- (이미 실행한 적이 있어도 전체를 다시 실행하면 됩니다. 아래 "히스토리 보존" 부분이 추가 적용됩니다.)

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

-- delete 정책은 두지 않음: 삭제는 deleted_at 으로 표시만 함 (아래 "히스토리 보존" 참고)

-- ============================================================
-- 히스토리 보존 (여러 번 실행해도 안전)
--  · 삭제는 행을 지우지 않고 deleted_at 에 시각만 기록 (소프트 삭제)
--  · 추가/수정/삭제/복구는 checklist_history 에 자동으로 기록 (트리거)
--  · 행을 실제로 지우는 권한(delete 정책)은 없앰 → 이력이 사라지지 않음
-- ============================================================

alter table public.checklist_items add column if not exists deleted_at timestamptz;

drop policy if exists "own items: delete" on public.checklist_items;

create table if not exists public.checklist_history (
  id          bigint generated always as identity primary key,
  item_id     uuid not null,
  user_id     uuid not null,
  action      text not null check (action in ('insert', 'update', 'delete', 'restore', 'purge')),
  old_data    jsonb,
  new_data    jsonb,
  changed_at  timestamptz not null default now()
);

create index if not exists checklist_history_user_time_idx
  on public.checklist_history (user_id, changed_at desc);
create index if not exists checklist_history_item_idx
  on public.checklist_history (item_id);

-- 이력은 본인 것만 읽기 가능. 쓰기는 아래 트리거만 (사용자가 직접 고치거나 지울 수 없음)
alter table public.checklist_history enable row level security;
drop policy if exists "own history: select" on public.checklist_history;
create policy "own history: select" on public.checklist_history
  for select to authenticated using ((select auth.uid()) = user_id);

create or replace function public.log_checklist_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  act text;
begin
  if tg_op = 'INSERT' then
    insert into public.checklist_history (item_id, user_id, action, new_data)
    values (new.id, new.user_id, 'insert', to_jsonb(new));
    return new;
  elsif tg_op = 'UPDATE' then
    if to_jsonb(old) = to_jsonb(new) then return new; end if;   -- 바뀐 게 없으면 기록 안 함
    act := case
      when old.deleted_at is null and new.deleted_at is not null then 'delete'
      when old.deleted_at is not null and new.deleted_at is null then 'restore'
      else 'update'
    end;
    insert into public.checklist_history (item_id, user_id, action, old_data, new_data)
    values (new.id, new.user_id, act, to_jsonb(old), to_jsonb(new));
    return new;
  else  -- DELETE: 관리자가 직접 지운 경우(purge)도 마지막 상태를 남김
    insert into public.checklist_history (item_id, user_id, action, old_data)
    values (old.id, old.user_id, 'purge', to_jsonb(old));
    return old;
  end if;
end;
$$;

drop trigger if exists checklist_items_history on public.checklist_items;
create trigger checklist_items_history
  after insert or update or delete on public.checklist_items
  for each row execute function public.log_checklist_change();
