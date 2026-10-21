-- Только для ЛОКАЛЬНОЙ проверки на обычном PostgreSQL (в Supabase всё это уже есть).
-- Имитирует роли, схему auth и функцию auth.uid() так же, как это делает Supabase/PostgREST:
-- PostgREST кладёт JWT-claims пользователя в настройку request.jwt.claims.
-- роли общие для всего кластера, поэтому создаём только если их ещё нет
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end $$;
create schema auth;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
  )::uuid
$$;
grant usage on schema public, auth to anon, authenticated;
-- В Supabase такие права на новые таблицы выдаются автоматически (default privileges)
alter default privileges in schema public grant all on tables to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'alice@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'bob@example.com');
