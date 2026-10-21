// path: src/shared/api/apiError.ts

/** Тип ошибки обращения к бэкенду — по нему интерфейс выбирает, что показать пользователю. */
export type ApiErrorKind =
  | 'network'
  | 'unauthorized'
  | 'forbidden'
  | 'not-found'
  | 'sold-out'
  | 'validation'
  | 'server';

const MESSAGES: Record<ApiErrorKind, string> = {
  network: 'Нет соединения с сервером. Проверьте интернет и повторите попытку.',
  unauthorized: 'Сессия истекла или вы не вошли. Войдите снова.',
  forbidden: 'Недостаточно прав: это действие доступно только автору записи.',
  'not-found': 'Запись не найдена. Возможно, её уже удалили.',
  'sold-out': 'Недостаточно свободных мест: их успели занять. Список обновлён, выберите меньше гостей.',
  validation: 'Сервер отклонил данные. Проверьте поля формы.',
  server: 'Ошибка на сервере. Попробуйте ещё раз через минуту.',
};

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status: number | null;

  constructor(kind: ApiErrorKind, status: number | null = null, options?: { cause?: unknown }) {
    super(MESSAGES[kind], options);
    this.name = 'ApiError';
    this.kind = kind;
    this.status = status;
  }
}

/** Приводит HTTP-статус к типу ошибки. status 0 или null — запрос не дошёл до сервера. */
export function kindFromStatus(status: number | null): ApiErrorKind {
  if (status === null || status === 0) return 'network';
  if (status === 401) return 'unauthorized';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not-found';
  if (status === 400 || status === 409 || status === 422) return 'validation';
  return 'server';
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  // Любая неизвестная ошибка (например, fetch упал до ответа) считается сетевой
  return new ApiError('network', null, { cause: error });
}
