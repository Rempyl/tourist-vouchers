// path: src/features/tours/validation.logic.test.ts
import { describe, expect, it } from 'vitest';
import type { TourFormValues } from './types/tour';
import { isValidDateOnly, toNewTour, validateTourForm } from './validation.logic';

const VALID: TourFormValues = {
  title: 'Анталья: всё включено',
  country: 'Турция',
  startDate: '2026-11-14',
  nights: '7',
  price: '54900',
  seats: '20',
};

describe('isValidDateOnly', () => {
  it('принимает существующую дату и високосный день', () => {
    expect(isValidDateOnly('2026-11-14')).toBe(true);
    expect(isValidDateOnly('2028-02-29')).toBe(true);
  });
  it('отклоняет несуществующие даты и мусор', () => {
    expect(isValidDateOnly('2026-02-31')).toBe(false);
    expect(isValidDateOnly('2027-02-29')).toBe(false);
    expect(isValidDateOnly('14.11.2026')).toBe(false);
  });
});

describe('validateTourForm', () => {
  it('корректные данные: ошибок нет', () => {
    expect(validateTourForm(VALID)).toEqual({});
  });

  it('граничные значения проходят: 1 ночь, 60 ночей, 500 мест, 3 символа в названии', () => {
    expect(validateTourForm({ ...VALID, title: 'Рим', nights: '1', seats: '500' })).toEqual({});
    expect(validateTourForm({ ...VALID, nights: '60' })).toEqual({});
  });

  it('пустая форма: ошибки по всем полям', () => {
    const errors = validateTourForm({ title: '', country: '', startDate: '', nights: '', price: '', seats: '' });
    expect(Object.keys(errors).sort()).toEqual(['country', 'nights', 'price', 'seats', 'startDate', 'title']);
  });

  it('числа: ноль, дробь, отрицательное и выход за максимум отклоняются', () => {
    expect(validateTourForm({ ...VALID, nights: '0' }).nights).toMatch(/от 1 до 60/);
    expect(validateTourForm({ ...VALID, nights: '61' }).nights).toMatch(/от 1 до 60/);
    expect(validateTourForm({ ...VALID, price: '10.5' }).price).toMatch(/целое/);
    expect(validateTourForm({ ...VALID, seats: '-3' }).seats).toMatch(/целое/);
    expect(validateTourForm({ ...VALID, seats: '501' }).seats).toMatch(/от 1 до 500/);
  });

  it('пробелы по краям не считаются символами названия', () => {
    expect(validateTourForm({ ...VALID, title: '  ab  ' }).title).toMatch(/минимум/);
  });

  it('несуществующая дата вылета отклоняется', () => {
    expect(validateTourForm({ ...VALID, startDate: '2026-02-31' }).startDate).toBe('Некорректная дата');
  });
});

describe('toNewTour', () => {
  it('обрезает пробелы и переводит числа', () => {
    expect(toNewTour({ ...VALID, title: ' Анталья ', country: ' Турция ' })).toEqual({
      title: 'Анталья',
      country: 'Турция',
      startDate: '2026-11-14',
      nights: 7,
      price: 54900,
      seats: 20,
    });
  });
});
