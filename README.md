# Туристические путёвки

Веб-приложение «АС Туристические путёвки»: каталог туров с фильтром по стране, онлайн-бронирование мест, список «Мои брони» и добавление туров менеджером.

**Стек:** React 19, TypeScript (strict), Vite, Tailwind CSS 4, Vitest + Testing Library. **База данных и авторизация:** Supabase (PostgreSQL, Auth, RLS). **Хостинг:** Vercel.

## Возможности

- Каталог туров: страна, даты (вылет и возвращение), число ночей, цена за человека, свободные места
- Фильтр по стране, ближайшие вылеты первыми
- Бронирование: выбор числа гостей (до 10), стоимость считается сразу; тур без мест забронировать нельзя
- «Мои брони»: список своих бронирований, отмена возвращает места в тур
- Добавление и удаление тура (удалять может только автор), валидация формы
- Защита от перебронирования на уровне БД: два одновременных запроса не займут одно место
- Состояния loading / error / empty, понятные сообщения об ошибках сети, доступа (401, 403), нехватки мест и сервера (5xx)
- Вход и регистрация (Supabase Auth)
- Адаптивная вёрстка: от 375 px (телефон) до десктопа

## Быстрый старт (режим mock, без Supabase)

```bash
npm install
npm run dev        # http://localhost:5173
```

Без переменных окружения приложение работает на тестовых данных в памяти (без входа). Состояние ошибки можно посмотреть так: `http://localhost:5173/?mock=network-error`.

## Запуск с Supabase

1. Создайте проект на [supabase.com](https://supabase.com).
2. В SQL Editor выполните файл `supabase/migrations/20261020000000_create_tours.sql`. (Файл `20261017000000_create_deadlines.sql` относится к прежней версии проекта и для туров не нужен.)
3. Скопируйте `.env.example` в `.env.local` и заполните значениями из Project Settings → API:
   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=<anon / publishable key>
   ```
4. `npm run dev`. Теперь приложение просит войти.

## Модель данных

| Таблица | Назначение | Кто что может |
|---|---|---|
| `tours` | Каталог туров (`seats` — всего мест, `seats_booked` — занято) | Читают все вошедшие; создаёт любой вошедший; менять и удалять может только автор. `seats_booked` и `author_id` клиент задать не может |
| `bookings` | Бронирования (`tour_id`, `user_id`, `guests`) | Каждый видит, создаёт и отменяет только свои |

Занятые места пересчитывает триггер `bookings_apply_seats`. Если мест не хватает, срабатывает ограничение `tours_seats_booked_range`, и бронь отклоняется (во фронтенде это ошибка `sold-out`).

## Скрипты

| Команда | Что делает |
|---|---|
| `npm run dev` | Dev-сервер с hot reload |
| `npm run build` | Проверка типов и production-сборка в `dist/` |
| `npm test` | Все тесты (Vitest) |
| `npm run lint` | Линтер (oxlint) |

## Структура

```
src/
  features/
    tours/       components/ hooks/ api/ types/ + *.logic.ts (чистая бизнес-логика)
    auth/        api/ components/
  shared/        api/ (Supabase-клиент, ApiError, логгер) components/
supabase/
  migrations/    SQL-миграции: tours, bookings, RLS, триггер мест
  tests/         проверка политик доступа на PostgreSQL
docs/screenshots/ скриншоты (остались от прежней версии, нужно переснять)
```

## Тесты

80 тестов: чистая логика (валидация, бронирование, фильтр и сортировка, форматирование), слой API (замена клиента на заглушку), компоненты и сценарии (каталог, бронь и отмена, добавление и удаление тура, фильтр, ошибки, вход). SQL-тесты политик доступа лежат в `supabase/tests/rls_tours_test.sql`; они требуют локального PostgreSQL и пока не запускались.

## Деплой на Netlify

Настройки лежат в `netlify.toml` (сборка `npm run build`, папка `dist`, Node 22, редирект всех путей на `/index.html`).

1. Репозиторий на GitHub: `Rempyl/tourist-vouchers`.
2. На app.netlify.com: Add new project → Import an existing project → GitHub → выберите репозиторий. Настройки подтянутся из `netlify.toml`.
3. До первого Deploy откройте Environment variables и добавьте `VITE_SUPABASE_URL` и `VITE_SUPABASE_ANON_KEY` (значения из Supabase, Project Settings → API).
4. После изменения переменных нужен повторный деплой (Deploys → Trigger deploy): значения `VITE_*` вшиваются в сборку.
5. В Supabase → Authentication → URL Configuration укажите адрес сайта на Netlify (Site URL и Redirect URLs).

## Деплой на Vercel (запасной вариант)

1. Загрузите репозиторий на GitHub.
2. На vercel.com: Add New → Project → выберите репозиторий (Framework Preset: Vite, настройки из `vercel.json`).
3. В Settings → Environment Variables добавьте `VITE_SUPABASE_URL` и `VITE_SUPABASE_ANON_KEY`.
4. После изменения переменных нужен повторный деплой: значения `VITE_*` вшиваются в сборку.
5. В Supabase → Authentication → URL Configuration укажите адрес сайта на Vercel (Site URL и Redirect URLs).
