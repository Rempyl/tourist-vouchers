-- Тесты политик доступа. Запуск: psql -v ON_ERROR_STOP=1 -f supabase/tests/rls_test.sql
-- Каждый тест проходит от имени роли и пользователя так же, как запрос из PostgREST.
\set alice '\'11111111-1111-1111-1111-111111111111\''
\set bob   '\'22222222-2222-2222-2222-222222222222\''

create temp table results (name text, ok boolean, detail text);
grant all on results to anon, authenticated;

create function pg_temp.act_as(role_name text, user_id text) returns void language plpgsql as $$
begin
  execute format('set local role %I', role_name);
  perform set_config('request.jwt.claims', json_build_object('sub', user_id, 'role', role_name)::text, true);
end $$;

-- 1. Анонимный пользователь не может читать
begin;
  select pg_temp.act_as('anon', null);
  do $$ begin
    perform count(*) from public.deadlines;
    insert into results values ('anon: чтение запрещено', false, 'запрос прошёл');
  exception when insufficient_privilege then
    insert into results values ('anon: чтение запрещено', true, 'permission denied');
  end $$;
commit;

-- 2. Alice создаёт дедлайн; author_id подставляется из JWT
begin;
  select pg_temp.act_as('authenticated', :alice);
  insert into public.deadlines (id, title, subject, due_date)
    values ('aaaaaaaa-0000-0000-0000-000000000001', 'Лабораторная №4', 'Сети', '2026-10-20');
  insert into results
    select 'alice: создаёт, author_id = её id', author_id = :alice::uuid, author_id::text
    from public.deadlines where id = 'aaaaaaaa-0000-0000-0000-000000000001';
commit;

-- 3. Bob видит дедлайн Alice
begin;
  select pg_temp.act_as('authenticated', :bob);
  insert into results select 'bob: читает чужой дедлайн', count(*) = 1, count(*)::text from public.deadlines;
commit;

-- 4. Bob не может изменить и удалить чужой дедлайн (RLS даёт 0 строк, а не ошибку)
begin;
  select pg_temp.act_as('authenticated', :bob);
  with u as (update public.deadlines set is_done = true where id = 'aaaaaaaa-0000-0000-0000-000000000001' returning 1)
    insert into results select 'bob: UPDATE чужого = 0 строк', count(*) = 0, count(*)::text from u;
  with d as (delete from public.deadlines where id = 'aaaaaaaa-0000-0000-0000-000000000001' returning 1)
    insert into results select 'bob: DELETE чужого = 0 строк', count(*) = 0, count(*)::text from d;
commit;

-- 5. Bob не может создать дедлайн от имени Alice (подмена author_id)
begin;
  select pg_temp.act_as('authenticated', :bob);
  do $$ begin
    insert into public.deadlines (title, subject, due_date, author_id)
      values ('Подмена автора', 'Сети', '2026-10-21', '11111111-1111-1111-1111-111111111111');
    insert into results values ('bob: подмена author_id запрещена', false, 'вставка прошла');
  exception when insufficient_privilege then
    insert into results values ('bob: подмена author_id запрещена', true, 'violates row-level security policy');
  end $$;
commit;

-- 6. Bob не может «передать» свой дедлайн Alice через UPDATE author_id
begin;
  select pg_temp.act_as('authenticated', :bob);
  insert into public.deadlines (id, title, subject, due_date)
    values ('bbbbbbbb-0000-0000-0000-000000000001', 'Дедлайн Боба', 'Экономика', '2026-10-22');
  do $$ begin
    update public.deadlines set author_id = '11111111-1111-1111-1111-111111111111'
      where id = 'bbbbbbbb-0000-0000-0000-000000000001';
    insert into results values ('bob: смена author_id запрещена', false, 'обновление прошло');
  exception when insufficient_privilege then
    insert into results values ('bob: смена author_id запрещена', true, 'violates row-level security policy');
  end $$;
commit;

-- 7. Alice меняет свой дедлайн; updated_at обновляется триггером
begin;
  select pg_temp.act_as('authenticated', :alice);
  update public.deadlines set is_done = true where id = 'aaaaaaaa-0000-0000-0000-000000000001';
  insert into results
    select 'alice: UPDATE своего, updated_at > created_at', is_done and updated_at > created_at, is_done::text
    from public.deadlines where id = 'aaaaaaaa-0000-0000-0000-000000000001';
commit;

-- 8. Ограничения данных: короткий заголовок, пустая дата
begin;
  select pg_temp.act_as('authenticated', :alice);
  do $$ begin
    insert into public.deadlines (title, subject, due_date) values ('ab', 'Сети', '2026-10-20');
    insert into results values ('check: заголовок из 2 символов отклонён', false, 'вставка прошла');
  exception when check_violation then
    insert into results values ('check: заголовок из 2 символов отклонён', true, 'deadlines_title_length');
  end $$;
  do $$ begin
    insert into public.deadlines (title, subject, due_date) values ('Нормальный', 'Сети', null);
    insert into results values ('not null: пустая дата отклонена', false, 'вставка прошла');
  exception when not_null_violation then
    insert into results values ('not null: пустая дата отклонена', true, 'due_date');
  end $$;
commit;

-- 9. Alice удаляет свой дедлайн
begin;
  select pg_temp.act_as('authenticated', :alice);
  with d as (delete from public.deadlines where id = 'aaaaaaaa-0000-0000-0000-000000000001' returning 1)
    insert into results select 'alice: DELETE своего = 1 строка', count(*) = 1, count(*)::text from d;
commit;

-- Итог
select case when ok then 'PASS' else 'FAIL' end as result, name, detail from results;
do $$ begin
  if exists (select 1 from results where not ok) then raise exception 'Есть упавшие тесты RLS'; end if;
end $$;
