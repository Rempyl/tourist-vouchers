// path: src/features/tours/booking.logic.ts
import type { Tour } from './types/tour';

/** Максимум гостей в одном бронировании (совпадает с check-ограничением в БД). */
export const MAX_GUESTS_PER_BOOKING = 10;

type SeatsInfo = Pick<Tour, 'seats' | 'seatsBooked'>;

export function getSeatsLeft(tour: SeatsInfo): number {
  return Math.max(0, tour.seats - tour.seatsBooked);
}

/** Сколько гостей можно выбрать в форме бронирования: от 1 до min(свободно, лимит). Пустой массив — мест нет. */
export function getGuestOptions(tour: SeatsInfo): number[] {
  const max = Math.min(getSeatsLeft(tour), MAX_GUESTS_PER_BOOKING);
  return Array.from({ length: max }, (_, index) => index + 1);
}

/** Текст ошибки, если забронировать нельзя, иначе null. */
export function checkBooking(tour: SeatsInfo, guests: number): string | null {
  if (!Number.isInteger(guests) || guests < 1) return 'Укажите число гостей: минимум 1';
  if (guests > MAX_GUESTS_PER_BOOKING) return `За один раз можно забронировать не больше ${MAX_GUESTS_PER_BOOKING} мест`;
  if (guests > getSeatsLeft(tour)) return 'Недостаточно свободных мест';
  return null;
}

/** Стоимость бронирования: цена за человека × число гостей. */
export function getBookingTotal(tour: Pick<Tour, 'price'>, guests: number): number {
  return tour.price * guests;
}
