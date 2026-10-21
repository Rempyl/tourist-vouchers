// path: src/features/tours/validation.logic.ts
import type { NewTour, TourFormValues } from './types/tour';

export const TITLE_MIN = 3;
export const TITLE_MAX = 120;
export const COUNTRY_MIN = 2;
export const COUNTRY_MAX = 60;
export const NIGHTS_MAX = 60;
export const PRICE_MAX = 10_000_000;
export const SEATS_MAX = 500;

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const INTEGER = /^\d+$/;

export type TourFormErrors = Partial<Record<keyof TourFormValues, string>>;

/** Проверяет, что строка — существующая календарная дата YYYY-MM-DD (31 февраля не пройдёт). */
export function isValidDateOnly(value: string): boolean {
  const match = DATE_ONLY.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function checkInteger(raw: string, label: string, min: number, max: number): string | undefined {
  const value = raw.trim();
  if (value === '') return `${label}: укажите число`;
  if (!INTEGER.test(value)) return `${label}: только целое число`;
  const number = Number(value);
  if (number < min || number > max) return `${label}: от ${min} до ${max}`;
  return undefined;
}

/** Возвращает ошибки по полям; пустой объект означает, что данные корректны. */
export function validateTourForm(values: TourFormValues): TourFormErrors {
  const errors: TourFormErrors = {};
  const title = values.title.trim();
  const country = values.country.trim();

  if (title.length < TITLE_MIN) errors.title = `Название: минимум ${TITLE_MIN} символа`;
  else if (title.length > TITLE_MAX) errors.title = `Название: максимум ${TITLE_MAX} символов`;

  if (country.length < COUNTRY_MIN) errors.country = `Страна: минимум ${COUNTRY_MIN} символа`;
  else if (country.length > COUNTRY_MAX) errors.country = `Страна: максимум ${COUNTRY_MAX} символов`;

  if (values.startDate === '') errors.startDate = 'Укажите дату вылета';
  else if (!isValidDateOnly(values.startDate)) errors.startDate = 'Некорректная дата';

  const nights = checkInteger(values.nights, 'Ночей', 1, NIGHTS_MAX);
  if (nights) errors.nights = nights;
  const price = checkInteger(values.price, 'Цена', 1, PRICE_MAX);
  if (price) errors.price = price;
  const seats = checkInteger(values.seats, 'Мест', 1, SEATS_MAX);
  if (seats) errors.seats = seats;

  return errors;
}

/** Переводит уже проверенную форму в данные для API. Вызывать только если validateTourForm вернул {}. */
export function toNewTour(values: TourFormValues): NewTour {
  return {
    title: values.title.trim(),
    country: values.country.trim(),
    startDate: values.startDate,
    nights: Number(values.nights),
    price: Number(values.price),
    seats: Number(values.seats),
  };
}
