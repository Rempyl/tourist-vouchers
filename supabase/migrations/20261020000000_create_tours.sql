-- Миграция: туристические путёвки и бронирования + RLS.
-- Применение: Supabase Dashboard → SQL Editor (вставить файл целиком) или `supabase db push`.
-- Таблица deadlines из предыдущей миграции не затрагивается.

create table public.tours (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  country      text not null,
  start_date   date not null,
  nights       integer not null,
  -- Цена за одного человека, целые рубли
  price        integer not null,
  seats        integer not null,
  -- Занятые места ведёт триггер по бронированиям, клиент это поле не меняет
  seats_booked integer not null default 0,
  -- Автор подставляется самой БД из JWT, клиент его не присылает
  author_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint tours_title_length   check (char_length(btrim(title))   between 3 and 120),
  constraint tours_country_length check (char_length(btrim(country)) between 2 and 60),
  constraint tours_nights_range   check (nights between 1 and 60),
  constraint tours_price_range    check (price between 1 and 10000000),
  constraint tours_seats_range    check (seats between 1 and 500),
  -- Это ограничение защищает от перебронирования: имя используется во фронтенде (supabaseToursApi.ts)
  constraint tours_seats_booked_range check (seats_booked between 0 and seats)
);

comment on table public.tours is 'Каталог туров. Читают все вошедшие, менять и удалять может только автор.';

create index tours_start_date_idx on public.tours (start_date);
create index tours_author_id_idx  on public.tours (author_id);

create table public.bookings (
  id         uuid primary key default gen_random_uuid(),
  tour_id    uuid not null references public.tours (id) on delete cascade,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  guests     integer not null,
  created_at timestamptz not null default now(),

  constraint bookings_guests_range check (guests between 1 and 10)
);

comment on table public.bookings is 'Бронирования. Каждый видит и отменяет только свои.';

create index bookings_tour_id_idx on public.bookings (tour_id);
create index bookings_user_id_idx on public.bookings (user_id);

-- updated_at обновляется триггером, а не клиентом.
-- or replace: функция с таким же телом уже создана миграцией deadlines
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger tours_set_updated_at
  before update on public.tours
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Подсчёт занятых мест
-- ---------------------------------------------------------------------------
-- security definer: пользователь бронирует чужой тур и не имеет права менять таблицу tours,
-- поэтому пересчёт выполняется от имени владельца функции. UPDATE блокирует строку тура,
-- так что два одновременных бронирования не займут одно и то же место.
-- Если мест не хватает, срабатывает tours_seats_booked_range и вставка брони отменяется.
create function public.apply_booking_to_seats()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.tours set seats_booked = seats_booked + new.guests where id = new.tour_id;
    return new;
  end if;
  update public.tours set seats_booked = seats_booked - old.guests where id = old.tour_id;
  return old;
end;
$$;

revoke all on function public.apply_booking_to_seats() from public, anon, authenticated;

create trigger bookings_apply_seats
  after insert or delete on public.bookings
  for each row execute function public.apply_booking_to_seats();

-- ---------------------------------------------------------------------------
-- Права и Row Level Security
-- ---------------------------------------------------------------------------
alter table public.tours    enable row level security;
alter table public.bookings enable row level security;

-- Анонимный доступ закрыт полностью
revoke all on public.tours    from anon;
revoke all on public.bookings from anon;

-- Права на уровне колонок: seats_booked, author_id и служебные поля клиент задать не может
revoke all on public.tours from authenticated;
grant select on public.tours to authenticated;
grant insert (title, country, start_date, nights, price, seats) on public.tours to authenticated;
grant update (title, country, start_date, nights, price, seats) on public.tours to authenticated;
grant delete on public.tours to authenticated;

revoke all on public.bookings from authenticated;
grant select on public.bookings to authenticated;
grant insert (tour_id, guests) on public.bookings to authenticated;
grant delete on public.bookings to authenticated;

-- Каталог: читают все вошедшие
create policy "tours_select_authenticated"
  on public.tours for select
  to authenticated
  using (true);

create policy "tours_insert_own"
  on public.tours for insert
  to authenticated
  with check (author_id = (select auth.uid()));

create policy "tours_update_own"
  on public.tours for update
  to authenticated
  using (author_id = (select auth.uid()))
  with check (author_id = (select auth.uid()));

create policy "tours_delete_own"
  on public.tours for delete
  to authenticated
  using (author_id = (select auth.uid()));

-- Бронирования: только свои
create policy "bookings_select_own"
  on public.bookings for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "bookings_insert_own"
  on public.bookings for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "bookings_delete_own"
  on public.bookings for delete
  to authenticated
  using (user_id = (select auth.uid()));
