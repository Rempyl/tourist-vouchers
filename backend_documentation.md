# ДЗ 5. Backend и интеграция с Frontend: документация

**Студент:** Мифтахов Р.А., группа 4381
**Проект:** DeadlineHub · **Backend:** Supabase (вариант A, BaaS) · **Хостинг фронтенда:** Vercel

## 0. Что проверено, а что нужно сделать вам

| Часть | Статус |
|---|---|
| SQL-миграция и политики RLS | **Проверено** на локальном PostgreSQL 16: 11 SQL-тестов проходят; при намеренно сломанной политике тесты падают |
| Слой API во фронтенде (маппинг, ошибки 401/403/500, нулевые строки под RLS) | **Проверено** автотестами с заглушкой клиента Supabase |
| Интерфейс входа, обработка ошибок | **Проверено** автотестами (63 теста всего) |
| Реальный проект Supabase, Auth по почте, HTTP-запросы к REST API | **Не проверялось**: у меня нет доступа к вашим аккаунтам. Выполните шаги из раздела 3, команды готовы |
| Деплой на Vercel | **Не выполнялся**, инструкция в разделе 3.4 |

Для честной сдачи после выполнения раздела 3 добавьте в `docs/screenshots/` скриншоты работающего приложения на Supabase и ссылку на деплой.

## 1. Архитектура (Шаги 1–2)

```
Браузер (React, Vercel)
   │  supabase-js (anon key + JWT пользователя)
   ▼
Supabase
 ├─ Auth (GoTrue): регистрация, вход, выдаёт JWT
 ├─ REST API (PostgREST): /rest/v1/deadlines — CRUD автоматически
 └─ PostgreSQL: таблица public.deadlines + политики RLS
```

**Почему Supabase, а не self-hosted:** проект учебный, нужны готовые Auth и REST API без своего сервера. Не нужны VPS и Docker; RLS даёт защиту на уровне БД. Минус: зависимость от сервиса и его бесплатных лимитов.

**Слои во фронтенде:**

```
Компонент → useDeadlines (хук) → DeadlinesApi (интерфейс)
                                   ├─ supabaseDeadlinesApi (боевая)
                                   └─ mockDeadlinesApi (разработка, тесты)
```

Компоненты не знают про Supabase. Клиент создаётся один раз в `shared/api/supabaseClient.ts`; если переменные окружения не заданы, приложение работает на mock.

## 2. База данных (Шаги 1, 3, 5)

Файл: `supabase/migrations/20261017000000_create_deadlines.sql`

### Таблица `public.deadlines`

| Поле | Тип | Ограничения |
|---|---|---|
| `id` | uuid | PK, `gen_random_uuid()` |
| `title` | text | not null, длина после `btrim` 3–120 |
| `subject` | text | not null, длина после `btrim` 2–60 |
| `due_date` | date | not null |
| `is_done` | boolean | not null, по умолчанию `false` |
| `author_id` | uuid | not null, по умолчанию `auth.uid()`, FK на `auth.users` (при удалении пользователя записи удаляются) |
| `created_at`, `updated_at` | timestamptz | `now()`; `updated_at` обновляет триггер |

Индексы: по `due_date` (сортировка списка) и `author_id` (проверки политик).

### Политики Row Level Security

| Операция | Кто может | Политика |
|---|---|---|
| SELECT | любой вошедший пользователь | `using (true)` для роли `authenticated` |
| INSERT | вошедший, только от своего имени | `with check (author_id = (select auth.uid()))` |
| UPDATE | только автор; нельзя сменить автора | `using` и `with check` по `author_id` |
| DELETE | только автор | `using (author_id = (select auth.uid()))` |
| любая | аноним | права отозваны (`revoke all ... from anon`) |

`(select auth.uid())` вместо прямого вызова функции: так Postgres считает значение один раз на запрос, а не для каждой строки.

### Важная особенность RLS

Если пользователь обновляет или удаляет **чужую** запись, PostgREST не возвращает ошибку: строка для него «невидима», поэтому затронуто 0 строк и ответ успешный. Фронтенд это учитывает: в `supabaseDeadlinesApi.ts` обновление и удаление запрашивают `.select()`, и пустой результат превращается в ошибку `forbidden` («Недостаточно прав: изменять дедлайн может только его автор»).

### Проверка политик

Файлы: `supabase/tests/00_local_emulation.sql` (имитация ролей и `auth.uid()` для обычного PostgreSQL) и `supabase/tests/rls_test.sql`.

```bash
psql -d <база> -f supabase/tests/00_local_emulation.sql          # только для локального PostgreSQL
psql -d <база> -f supabase/migrations/20261017000000_create_deadlines.sql
psql -d <база> -v ON_ERROR_STOP=1 -f supabase/tests/rls_test.sql
```

Результат (11 из 11):

| Тест | Ожидание |
|---|---|
| anon: чтение | permission denied |
| alice: создаёт, `author_id` = её id | автор подставлен из JWT |
| bob: читает чужой дедлайн | 1 строка |
| bob: UPDATE / DELETE чужого | 0 строк |
| bob: подмена `author_id` при INSERT | нарушение политики |
| bob: смена `author_id` через UPDATE | нарушение политики |
| alice: UPDATE своего | успешно, `updated_at` обновился |
| check: заголовок из 2 символов | отклонён (`deadlines_title_length`) |
| not null: пустая дата | отклонена |
| alice: DELETE своего | 1 строка |

Тесты проверены «от обратного»: если добавить лишнюю политику `update ... using (true)`, два теста честно падают.

## 3. Развёртывание (Шаги 3, 5, 6)

### 3.1. Создание проекта Supabase

1. supabase.com → New project (запомните пароль БД, в репозиторий его не кладём).
2. SQL Editor → New query → вставить `supabase/migrations/20261017000000_create_deadlines.sql` → Run.
3. Table Editor → у таблицы `deadlines` должна быть пометка RLS enabled и 4 политики.
4. Authentication → Providers → Email: включён. Для быстрой проверки можно отключить Confirm email (иначе после регистрации нужно подтвердить почту).

### 3.2. Переменные окружения

Project Settings → API: `Project URL` и `anon public` ключ.

```bash
cp .env.example .env.local
# VITE_SUPABASE_URL=https://xxxx.supabase.co
# VITE_SUPABASE_ANON_KEY=<anon public>
npm run dev
```

**Секреты:** в браузере используется только публичный `anon`-ключ, он безопасен при включённом RLS. Ключ `service_role` обходит RLS и во фронтенд попадать не должен. `.env` и `.env.local` в `.gitignore`, в репозитории только `.env.example`.

### 3.3. CORS и Auth

- REST API Supabase обрабатывает CORS сам, отдельной настройки для запросов из браузера не требуется. Защита данных держится на JWT и RLS, а не на списке доменов.
- Для Auth укажите адрес сайта: Authentication → URL Configuration → Site URL = `https://<ваш-проект>.vercel.app`, Redirect URLs — тот же адрес и `http://localhost:5173`. Иначе ссылки из писем подтверждения будут вести не туда.

### 3.4. Деплой фронтенда на Vercel

1. Запушить проект на GitHub.
2. vercel.com → Add New → Project → выбрать репозиторий. Настройки берутся из `vercel.json` (сборка `npm run build`, папка `dist`).
3. Settings → Environment Variables → добавить `VITE_SUPABASE_URL` и `VITE_SUPABASE_ANON_KEY` (Production и Preview).
4. Redeploy. **Переменные `VITE_*` вшиваются в сборку при билде**, после их изменения нужен новый деплой. Это подтверждено проверкой: без переменных клиент Supabase в бандл не попадает (240 КБ), с переменными попадает (457 КБ).
5. Прописать адрес сайта в Supabase (3.3).

## 4. API (Шаг 4)

Использован автоматический REST API Supabase (PostgREST), собственный сервер не нужен. Базовый адрес: `https://<project>.supabase.co`. Во всех запросах два заголовка: `apikey: <anon key>` и `Authorization: Bearer <access_token пользователя>`.

### Аутентификация

| Операция | Запрос |
|---|---|
| Регистрация | `POST /auth/v1/signup` · тело `{"email": "...", "password": "..."}` |
| Вход | `POST /auth/v1/token?grant_type=password` · то же тело · в ответе `access_token` |

```bash
curl -X POST "$URL/auth/v1/token?grant_type=password" \
  -H "apikey: $ANON" -H "Content-Type: application/json" \
  -d '{"email":"rem@example.com","password":"secret123"}'
```

### Эндпоинты CRUD

| Операция | Запрос | Ответ |
|---|---|---|
| Список | `GET /rest/v1/deadlines?select=id,title,subject,due_date,is_done&order=due_date.asc` | 200, массив |
| Создание | `POST /rest/v1/deadlines` · заголовок `Prefer: return=representation` | 201, созданная строка |
| Отметка выполнено | `PATCH /rest/v1/deadlines?id=eq.<uuid>` · тело `{"is_done": true}` · `Prefer: return=representation` | 200, массив с изменённой строкой (пустой, если запись чужая) |
| Удаление | `DELETE /rest/v1/deadlines?id=eq.<uuid>` · `Prefer: return=representation` | 200, массив с удалённой строкой (пустой, если запись чужая) |

Примеры (переменные `URL`, `ANON`, `TOKEN` задаёт пользователь):

```bash
# список
curl "$URL/rest/v1/deadlines?select=*&order=due_date.asc" \
  -H "apikey: $ANON" -H "Authorization: Bearer $TOKEN"

# создание (author_id не передаётся, подставляется из токена)
curl -X POST "$URL/rest/v1/deadlines" \
  -H "apikey: $ANON" -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -H "Prefer: return=representation" \
  -d '{"title":"Лабораторная №4","subject":"Сети","due_date":"2026-10-20"}'

# отметка выполненным
curl -X PATCH "$URL/rest/v1/deadlines?id=eq.<uuid>" \
  -H "apikey: $ANON" -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -H "Prefer: return=representation" \
  -d '{"is_done":true}'

# удаление
curl -X DELETE "$URL/rest/v1/deadlines?id=eq.<uuid>" \
  -H "apikey: $ANON" -H "Authorization: Bearer $TOKEN" -H "Prefer: return=representation"
```

Эти команды я не запускал на реальном проекте (раздел 0). Логика политик проверена SQL-тестами, формат запросов соответствует документации PostgREST.

### Проверка прав через интерфейс (демонстрация RLS)

Зарегистрируйте двух пользователей, под первым создайте дедлайн, затем войдите вторым: дедлайн виден, но «Выполнено» и «Удалить» дают сообщение «Недостаточно прав: изменять дедлайн может только его автор».

## 5. Безопасность (Шаг 5)

| Требование | Реализация |
|---|---|
| Аутентификация | Supabase Auth (email + пароль), форма входа и регистрации, выход |
| Политики доступа | RLS на таблице, политики по операциям (раздел 2) |
| Секреты вне кода | `.env.local` в `.gitignore`, `.env.example` без значений, в коде только `import.meta.env`, `service_role` не используется |
| CORS | Обрабатывает Supabase (раздел 3.3) |
| Валидация | На клиенте (`validation.logic.ts`) и в БД (check-ограничения): БД остаётся последней линией защиты |
| Анонимный доступ | Закрыт: без входа приложение показывает только форму входа, а в БД права `anon` отозваны |

## 6. Интеграция Frontend ↔ Backend (Шаг 6)

- Клиент: `@supabase/supabase-js` (единственная новая зависимость, добавлена осознанно).
- API-слой: `src/features/deadlines/api/supabaseDeadlinesApi.ts` (list / create / setDone / remove) и `src/features/auth/api/authApi.ts`.
- Хук `useDeadlines` держит состояние (loading / error / success), mock-данные в боевом режиме не используются: `services.ts` выбирает реализацию по наличию переменных окружения.
- Преобразование имён: в БД `due_date`, `is_done`, во фронтенде `dueDate`, `isDone` (`rowToDeadline`).

## 7. Обработка ошибок и логирование (Шаг 7)

| Ситуация | HTTP | Тип в приложении | Что видит пользователь |
|---|---|---|---|
| Нет интернета, сервер недоступен | 0 / сбой fetch | `network` | «Нет соединения с сервером…» + кнопка «Повторить» |
| Нет входа или токен истёк | 401 | `unauthorized` | «Сессия истекла или вы не вошли. Войдите снова.» |
| Нет прав (политика RLS, чужая запись) | 403 или 0 строк | `forbidden` | «Недостаточно прав: изменять дедлайн может только его автор.» |
| Запись не найдена | 404 | `not-found` | «Запись не найдена…» |
| Данные не прошли проверки | 400 / 409 / 422 | `validation` | «Сервер отклонил данные. Проверьте поля формы.» |
| Ошибка сервера | 5xx | `server` | «Ошибка на сервере. Попробуйте ещё раз через минуту.» |
| Неверная почта или пароль | 400 при входе | `unauthorized` | «Неверная почта или пароль.» |

Ошибки валидации формы проверяются до отправки (сообщения под полями). Сопоставление статусов покрыто тестами (`apiError.test.ts`).

**Логирование:** каждая ошибка API пишется в консоль браузера структурированной JSON-строкой одним модулем `shared/api/logger.ts`:

```json
{"level":"error","context":"deadlines.list","message":"unauthorized","time":"2026-10-17T11:00:00.000Z","status":401,"code":"PGRST301","detail":"JWT expired"}
```

Уровни: `info`, `warning` (например, «0 строк затронуто»), `error`. Серверные логи доступны в Supabase Dashboard → Logs (API, Postgres, Auth). Централизованного хранилища логов фронтенда нет, для учебного проекта достаточно консоли и логов Supabase.

## 8. Тестирование и отладка (Шаг 8)

| Что | Как | Результат |
|---|---|---|
| Политики доступа и ограничения | `supabase/tests/rls_test.sql` на PostgreSQL 16 | 11 из 11 |
| Маппинг данных и ошибки API | `supabaseDeadlinesApi.test.ts` (заглушка клиента) | 401, 403, 5xx, сетевая ошибка, 0 строк под RLS |
| Интерфейс, вход, ошибки | Testing Library | 63 теста всего, все проходят |
| Типы, линтер, сборка | `tsc`, `oxlint`, `vite build` | без ошибок (1 ложное предупреждение линтера, см. отчёт ДЗ 4) |

**Что нашлось при отладке:**

1. **Идемпотентность тестового скрипта.** Роли PostgreSQL общие для всего кластера, поэтому повторный запуск `00_local_emulation.sql` падал с «role anon already exists». Создание ролей обёрнуто в проверку существования.
2. **Тихий отказ RLS.** Обновление чужой записи не даёт ошибки, а возвращает 0 строк. Без специальной обработки пользователь увидел бы «успех», а запись не изменилась. Добавлена проверка пустого результата (раздел 2).
3. **Проверка самих тестов.** Чтобы убедиться, что SQL-тесты что-то ловят, в базу добавлена заведомо дырявая политика: тесты «UPDATE чужого» и «смена author_id» упали, как и должны.
4. **Переменные окружения на Vercel.** `VITE_*` читаются при сборке. Без них в бандл не попадает клиент Supabase, поэтому после добавления переменных на Vercel нужен повторный деплой.

## 9. Использование AI

**Агент:** Claude Code. Ниже промпты по реальному ходу работы.

1. **Проектирование схемы (по шаблону №6 из ДЗ 2):**
   ```
   ## Role  Ты — backend-разработчик, проектируешь схему PostgreSQL для Supabase.
   ## Task  Создай миграцию для таблицы deadlines: название, предмет, срок, автор, выполнено.
            Включи RLS: читают все вошедшие, создаёт, меняет и удаляет только автор.
   ## Context  Supabase Auth, author_id → auth.users, имена snake_case, никаких секретов в SQL.
   ## Format  Схема списком, SQL одним блоком, тестовые запросы (проходит / отклоняется).
   ```
   Результат: миграция из раздела 2. Что добавлено сверх запроса: триггер `updated_at`, индексы, отзыв прав у `anon`, `(select auth.uid())`.
2. **Тесты политик:** «Напиши SQL-тесты для политик: анонимный доступ, чужие UPDATE/DELETE, подмена author_id, check-ограничения. Запусти на локальном PostgreSQL». Получился `rls_test.sql`.
3. **API-слой:** «Реализуй DeadlinesApi для Supabase. Ошибки приводи к ApiError по HTTP-статусу. Учти, что RLS при чужой записи возвращает 0 строк, а не ошибку». Результат: `supabaseDeadlinesApi.ts` и тесты с заглушкой клиента.
4. **Анализ ошибок:** лог из консоли (JSON) вставляется в чат с просьбой найти причину. Пример запроса: «Вот лог: `{"level":"error","context":"deadlines.create","message":"forbidden","status":403,"code":"42501"}`. Что это значит и где смотреть политику?»

**Что проверено вручную, а не доверено модели:** результаты тестов, сам факт срабатывания политик (проверка «от обратного»), размеры бандла, отсутствие ключей в коде.

## 10. Критерии приёмки: чек-лист

| Критерий | Статус |
|---|---|
| БД развёрнута и работает | Схема готова и проверена локально; на вашем проекте Supabase выполнить раздел 3.1 |
| API работает (3+ операции CRUD) | Реализованы list / create / update / delete |
| Frontend подключается к Backend, данные идут в обе стороны | Реализовано, тесты проходят; живая проверка после раздела 3.2 |
| Аутентификация, RLS, секреты, CORS | Реализованы (раздел 5) |
| Обработка сетевых ошибок и валидации, логи | Реализованы (раздел 7) |
| Документация и инструкции | Этот файл и `README.md` |
| Использование AI | Раздел 9 |
