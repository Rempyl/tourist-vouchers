// path: src/features/tours/booking.logic.test.ts
import { describe, expect, it } from 'vitest';
import { MAX_GUESTS_PER_BOOKING, checkBooking, getBookingTotal, getGuestOptions, getSeatsLeft } from './booking.logic';

const tour = { seats: 20, seatsBooked: 12, price: 54900 };

describe('getSeatsLeft', () => {
  it('считает свободные места', () => {
    expect(getSeatsLeft(tour)).toBe(8);
  });
  it('не уходит в минус, если данные рассинхронизированы', () => {
    expect(getSeatsLeft({ seats: 5, seatsBooked: 7 })).toBe(0);
  });
});

describe('getGuestOptions', () => {
  it('до числа свободных мест', () => {
    expect(getGuestOptions({ seats: 5, seatsBooked: 2 })).toEqual([1, 2, 3]);
  });
  it('не больше лимита на одну бронь', () => {
    expect(getGuestOptions({ seats: 100, seatsBooked: 0 })).toHaveLength(MAX_GUESTS_PER_BOOKING);
  });
  it('мест нет: пустой список', () => {
    expect(getGuestOptions({ seats: 6, seatsBooked: 6 })).toEqual([]);
  });
});

describe('checkBooking', () => {
  it('можно забронировать в пределах свободных мест, включая последнее', () => {
    expect(checkBooking(tour, 1)).toBeNull();
    expect(checkBooking(tour, 8)).toBeNull();
  });
  it('больше свободных мест — ошибка', () => {
    expect(checkBooking(tour, 9)).toBe('Недостаточно свободных мест');
  });
  it('0, дробное и отрицательное число гостей — ошибка', () => {
    expect(checkBooking(tour, 0)).toMatch(/минимум 1/);
    expect(checkBooking(tour, 1.5)).toMatch(/минимум 1/);
    expect(checkBooking(tour, -2)).toMatch(/минимум 1/);
  });
  it('больше лимита на одну бронь — ошибка даже при свободных местах', () => {
    expect(checkBooking({ seats: 100, seatsBooked: 0 }, MAX_GUESTS_PER_BOOKING + 1)).toMatch(/не больше/);
  });
});

describe('getBookingTotal', () => {
  it('цена за человека × гости', () => {
    expect(getBookingTotal(tour, 3)).toBe(164700);
  });
});
