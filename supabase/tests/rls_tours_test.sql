-- Тесты политик доступа для tours и bookings.
-- Запуск на локальном PostgreSQL после 00_local_emulation.sql и обеих миграций:
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/rls_tours_test.sql
\set alice '\'11111111-1111-1111-1111-111111111111\''
\set bob   '\'22222222-2222-2222-2222-222222222222\''

create temp table results (name text, ok boolean, detail text);
grant all on results to anon, authenticated;

create function pg_temp.act_as(role_name text, user_id text) returns void language plpgsql as $$
begin
  execute format('set local role %I', role_name);
  perform set_config('request.jwt.claims', json_build_object('sub', user_id, 'role', role_name)::text, true);
end $$;

-- 1. Анонимный пользователь не читает каталог и брони
begin;
  select pg_temp.act_as('anon', null);
  do $$ begin
    perform count(*) from public.tours;
    insert into results values ('anon: чтение tours запрещено', false, 'запрос прошёл');
  exception when insufficient_privilege then
    insert into results values ('anon: чтение tours запрещено', true, 'permission denied');
  end $$;
  do $$ begin
    perform count(*) from public.bookings;
    insert into results values ('anon: чтение bookings запрещено', false, 'запрос прошёл');
  exception when insufficient_privilege then
    insert into results values ('anon: чтение bookings запрещено', true, 'permission denied');
  end $$;
commit;

-- 2. Alice создаёт тур на 3 места; author_id из JWT, seats_booked = 0
begin;
  select pg_temp.act_as('authenticated', :alice);
  insert into public.tours (id, title, country, start_date, nights, price, seats)
    values ('aaaaaaaa-0000-0000-0000-000000000001', 'Анталья', 'Турция', '2026-11-14', 7, 54900, 3);
  insert into results
    select 'alice: создаёт тур, author_id = её id, занято 0', author_id = :alice::uuid and seats_booked = 0, author_id::text
    from public.tours where id = 'aaaaaaaa-0000-0000-0000-000000000001';
commit;

-- 3. Bob видит тур Alice, но не может его изменить или удалить (0 строк)
begin;
  select pg_temp.act_as('authenticated', :bob);
  insert into results select 'bob: читает чужой тур', count(*) = 1, count(*)::text from public.tours;
  with u as (update public.tours set price = 1 where id = 'aaaaaaaa-0000-0000-0000-000000000001' returning 1)
    insert into results select 'bob: UPDATE чужого тура = 0 строк', count(*) = 0, count(*)::text from u;
  with d as (delete from public.tours where id = 'aaaaaaaa-0000-0000-0000-000000000001' returning 1)
    insert into results select 'bob: DELETE чужого тура = 0 строк', count(*) = 0, count(*)::text from d;
commit;

-- 4. Нельзя самому задать занятые места или подменить автора
begin;
  select pg_temp.act_as('authenticated', :bob);
  do $$ begin
    insert into public.tours (title, country, start_date, nights, price, seats, seats_booked)
      values ('Подделка', 'Египет', '2026-12-01', 5, 1000, 10, 5);
    insert into results values ('bob: задать seats_booked при создании запрещено', false, 'вставка прошла');
  exception when insufficient_privilege then
    insert into results values ('bob: задать seats_booked при создании запрещено', true, 'permission denied');
  end $$;
  do $$ begin
    insert into public.tours (title, country, start_date, nights, price, seats, author_id)
      values ('Чужой автор', 'Египет', '2026-12-01', 5, 1000, 10, '11111111-1111-1111-1111-111111111111');
    insert into results values ('bob: подмена author_id запрещена', false, 'вставка прошла');
  exception when insufficient_privilege then
    insert into results values ('bob: подмена author_id запрещена', true, 'permission denied');
  end $$;
commit;

-- 5. Bob бронирует 2 места из 3: seats_booked пересчитан триггером
begin;
  select pg_temp.act_as('authenticated', :bob);
  insert into public.bookings (id, tour_id, guests)
    values ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 2);
  insert into results
    select 'bob: бронь на 2 места, user_id = его id', user_id = :bob::uuid, user_id::text
    from public.bookings where id = 'bbbbbbbb-0000-0000-0000-000000000001';
  insert into results
    select 'триггер: seats_booked = 2', seats_booked = 2, seats_booked::text
    from public.tours where id = 'aaaaaaaa-0000-0000-0000-000000000001';
commit;

-- 6. Alice не видит и не отменяет чужую бронь
begin;
  select pg_temp.act_as('authenticated', :alice);
  insert into results select 'alice: чужая бронь не видна', count(*) = 0, count(*)::text from public.bookings;
  with d as (delete from public.bookings where id = 'bbbbbbbb-0000-0000-0000-000000000001' returning 1)
    insert into results select 'alice: DELETE чужой брони = 0 строк', count(*) = 0, count(*)::text from d;
commit;

-- 7. Перебронирование: ещё 2 места при одном свободном отклоняются, занятость не меняется
begin;
  select pg_temp.act_as('authenticated', :bob);
  do $$ begin
    insert into public.bookings (tour_id, guests) values ('aaaaaaaa-0000-0000-0000-000000000001', 2);
    insert into results values ('bob: бронь сверх мест отклонена', false, 'вставка прошла');
  exception when check_violation then
    insert into results values ('bob: бронь сверх мест отклонена', true, 'tours_seats_booked_range');
  end $$;
  insert into results
    select 'после отказа seats_booked всё ещё 2', seats_booked = 2, seats_booked::text
    from public.tours where id = 'aaaaaaaa-0000-0000-0000-000000000001';
commit;

-- 8. Нельзя подменить user_id брони и записать 0 или 11 гостей
begin;
  select pg_temp.act_as('authenticated', :bob);
  do $$ begin
    insert into public.bookings (tour_id, user_id, guests)
      values ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 1);
    insert into results values ('bob: подмена user_id брони запрещена', false, 'вставка прошла');
  exception when insufficient_privilege then
    insert into results values ('bob: подмена user_id брони запрещена', true, 'permission denied');
  end $$;
  do $$ begin
    insert into public.bookings (tour_id, guests) values ('aaaaaaaa-0000-0000-0000-000000000001', 0);
    insert into results values ('check: 0 гостей отклонено', false, 'вставка прошла');
  exception when check_violation then
    insert into results values ('check: 0 гостей отклонено', true, 'bookings_guests_range');
  end $$;
commit;

-- 9. Bob отменяет свою бронь: места возвращаются
begin;
  select pg_temp.act_as('authenticated', :bob);
  with d as (delete from public.bookings where id = 'bbbbbbbb-0000-0000-0000-000000000001' returning 1)
    insert into results select 'bob: DELETE своей брони = 1 строка', count(*) = 1, count(*)::text from d;
  insert into results
    select 'триггер: после отмены seats_booked = 0', seats_booked = 0, seats_booked::text
    from public.tours where id = 'aaaaaaaa-0000-0000-0000-000000000001';
commit;

-- 10. Alice удаляет свой тур; брони тура удаляются каскадом
begin;
  select pg_temp.act_as('authenticated', :bob);
  insert into public.bookings (id, tour_id, guests)
    values ('bbbbbbbb-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 1);
commit;
begin;
  select pg_temp.act_as('authenticated', :alice);
  with d as (delete from public.tours where id = 'aaaaaaaa-0000-0000-0000-000000000001' returning 1)
    insert into results select 'alice: DELETE своего тура = 1 строка', count(*) = 1, count(*)::text from d;
commit;
begin;
  select pg_temp.act_as('authenticated', :bob);
  insert into results select 'каскад: брони удалённого тура исчезли', count(*) = 0, count(*)::text from public.bookings;
commit;

-- Итог
select case when ok then 'PASS' else 'FAIL' end as result, name, detail from results;
do $$ begin
  if exists (select 1 from results where not ok) then raise exception 'Есть упавшие тесты RLS'; end if;
end $$;
