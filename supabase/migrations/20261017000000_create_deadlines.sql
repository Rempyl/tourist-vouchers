-- Миграция: таблица дедлайнов группы + RLS.
-- Применение: Supabase Dashboard → SQL Editor (вставить файл целиком) или `supabase db push`.

create table public.deadlines (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  subject    text not null,
  due_date   date not null,
  is_done    boolean not null default false,
  -- Автор подставляется самой БД из JWT, клиент его не присылает
  author_id  uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint deadlines_title_length   check (char_length(btrim(title))   between 3 and 120),
  constraint deadlines_subject_length check (char_length(btrim(subject)) between 2 and 60)
);

comment on table public.deadlines is 'Общие дедлайны студенческой группы. Читают все вошедшие, меняет только автор.';

create index deadlines_due_date_idx  on public.deadlines (due_date);
create index deadlines_author_id_idx on public.deadlines (author_id);

-- updated_at обновляется триггером, а не клиентом
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger deadlines_set_updated_at
  before update on public.deadlines
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.deadlines enable row level security;

-- Анонимный доступ закрыт полностью (без входа список не виден)
revoke all on public.deadlines from anon;

-- Читать могут все вошедшие пользователи (один общий список группы)
create policy "deadlines_select_authenticated"
  on public.deadlines for select
  to authenticated
  using (true);

-- Создавать можно только от своего имени
create policy "deadlines_insert_own"
  on public.deadlines for insert
  to authenticated
  with check (author_id = (select auth.uid()));

-- Менять и удалять может только автор
create policy "deadlines_update_own"
  on public.deadlines for update
  to authenticated
  using (author_id = (select auth.uid()))
  with check (author_id = (select auth.uid()));

create policy "deadlines_delete_own"
  on public.deadlines for delete
  to authenticated
  using (author_id = (select auth.uid()));
