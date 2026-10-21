// path: src/features/tours/format.logic.ts
import { getSeatsLeft } from './booking.logic';
import type { Tour } from './types/tour';

const DATE_FORMAT = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', timeZone: 'UTC' });
const PRICE_FORMAT = new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 });
const PLURALS = new Intl.PluralRules('ru-RU');

interface Forms {
  one: string;
  few: string;
  many: string;
}

function plural(count: number, forms: Forms): string {
  const category = PLURALS.select(count);
  if (category === 'one') return forms.one;
  if (category === 'many') return forms.many;
  return forms.few;
}

export const formatNights = (count: number): string =>
  `${count} ${plural(count, { one: 'ночь', few: 'ночи', many: 'ночей' })}`;

export const formatGuests = (count: number): string =>
  `${count} ${plural(count, { one: 'гость', few: 'гостя', many: 'гостей' })}`;

/** «54 900 ₽» (обычный пробел вместо неразрывного, чтобы текст легко искать и копировать). */
export function formatPrice(price: number): string {
  return PRICE_FORMAT.format(price).replace(/[  ]/g, ' ');
}

/** Дата возвращения: вылет + число ночей (в UTC). */
export function getEndDate(startDate: string, nights: number): string {
  const date = new Date(startDate);
  date.setUTCDate(date.getUTCDate() + nights);
  return date.toISOString().slice(0, 10);
}

/** «14 ноября – 21 ноября» */
export function formatDateRange(startDate: string, nights: number): string {
  const start = new Date(startDate);
  if (Number.isNaN(start.getTime())) return 'дата не указана';
  return `${DATE_FORMAT.format(start)} – ${DATE_FORMAT.format(new Date(getEndDate(startDate, nights)))}`;
}

/** «Осталось 8 из 20 мест» или «Мест нет». */
export function formatSeats(tour: Pick<Tour, 'seats' | 'seatsBooked'>): string {
  const left = getSeatsLeft(tour);
  return left === 0 ? 'Мест нет' : `Осталось ${left} из ${tour.seats} мест`;
}
