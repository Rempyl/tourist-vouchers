// path: src/features/tours/selectors.logic.ts
import type { Tour } from './types/tour';

export const ALL_COUNTRIES = '';

/** Уникальные страны по алфавиту (для фильтра). */
export function getCountries(tours: readonly Tour[]): string[] {
  return [...new Set(tours.map((t) => t.country))].sort((a, b) => a.localeCompare(b, 'ru'));
}

/** Список для показа: фильтр по стране, ближайшие вылеты первыми. Вход не мутируется. */
export function selectVisibleTours(tours: readonly Tour[], country: string): Tour[] {
  return tours
    .filter((t) => country === ALL_COUNTRIES || t.country === country)
    .sort((a, b) => a.startDate.localeCompare(b.startDate) || a.id.localeCompare(b.id));
}
