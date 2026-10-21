// path: src/features/tours/selectors.logic.test.ts
import { describe, expect, it } from 'vitest';
import { ALL_COUNTRIES, getCountries, selectVisibleTours } from './selectors.logic';
import type { Tour } from './types/tour';

const make = (id: string, country: string, startDate: string): Tour => ({
  id,
  title: `Тур ${id}`,
  country,
  startDate,
  nights: 7,
  price: 1000,
  seats: 10,
  seatsBooked: 0,
});

const TOURS = [make('b', 'Турция', '2026-12-01'), make('a', 'Египет', '2026-11-10'), make('c', 'Турция', '2026-11-10')];

describe('getCountries', () => {
  it('уникальные страны по алфавиту', () => {
    expect(getCountries(TOURS)).toEqual(['Египет', 'Турция']);
  });
  it('пустой список', () => {
    expect(getCountries([])).toEqual([]);
  });
});

describe('selectVisibleTours', () => {
  it('без фильтра: ближайшие вылеты первыми, при равной дате по id', () => {
    expect(selectVisibleTours(TOURS, ALL_COUNTRIES).map((t) => t.id)).toEqual(['a', 'c', 'b']);
  });
  it('фильтр по стране', () => {
    expect(selectVisibleTours(TOURS, 'Турция').map((t) => t.id)).toEqual(['c', 'b']);
  });
  it('страна без туров — пустой список', () => {
    expect(selectVisibleTours(TOURS, 'Греция')).toEqual([]);
  });
  it('не мутирует входной массив', () => {
    const copy = [...TOURS];
    selectVisibleTours(TOURS, ALL_COUNTRIES);
    expect(TOURS).toEqual(copy);
  });
});
