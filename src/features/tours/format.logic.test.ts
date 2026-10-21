// path: src/features/tours/format.logic.test.ts
import { describe, expect, it } from 'vitest';
import { formatDateRange, formatGuests, formatNights, formatPrice, formatSeats, getEndDate } from './format.logic';

describe('formatNights / formatGuests', () => {
  it.each([
    [1, '1 ночь'],
    [2, '2 ночи'],
    [5, '5 ночей'],
    [11, '11 ночей'],
    [21, '21 ночь'],
  ])('ночи: %s → %s', (count, expected) => {
    expect(formatNights(count)).toBe(expected);
  });

  it.each([
    [1, '1 гость'],
    [3, '3 гостя'],
    [10, '10 гостей'],
  ])('гости: %s → %s', (count, expected) => {
    expect(formatGuests(count)).toBe(expected);
  });
});

describe('formatPrice', () => {
  it('рубли с разделителем тысяч', () => {
    expect(formatPrice(54900)).toBe('54 900 ₽');
  });
});

describe('getEndDate / formatDateRange', () => {
  it('прибавляет ночи и переходит через границу месяца и года', () => {
    expect(getEndDate('2026-11-14', 7)).toBe('2026-11-21');
    expect(getEndDate('2026-12-28', 7)).toBe('2027-01-04');
  });
  it('форматирует диапазон по-русски', () => {
    expect(formatDateRange('2026-11-14', 7)).toBe('14 ноября – 21 ноября');
  });
  it('некорректная дата не ломает интерфейс', () => {
    expect(formatDateRange('не дата', 7)).toBe('дата не указана');
  });
});

describe('formatSeats', () => {
  it('осталось мест', () => {
    expect(formatSeats({ seats: 20, seatsBooked: 12 })).toBe('Осталось 8 из 20 мест');
  });
  it('мест нет', () => {
    expect(formatSeats({ seats: 6, seatsBooked: 6 })).toBe('Мест нет');
  });
});
