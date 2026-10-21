// path: src/features/tours/api/mockToursApi.ts
import { ApiError } from '../../../shared/api/apiError';
import { checkBooking } from '../booking.logic';
import type { Booking, NewTour, Tour } from '../types/tour';
import type { ToursApi } from './toursApi';

export const MOCK_SEED: readonly Tour[] = [
  { id: 'm1', title: 'Анталья: всё включено, 5★', country: 'Турция', startDate: '2026-11-14', nights: 7, price: 54900, seats: 20, seatsBooked: 12 },
  { id: 'm2', title: 'Хургада: отдых у Красного моря', country: 'Египет', startDate: '2026-11-21', nights: 10, price: 61500, seats: 16, seatsBooked: 4 },
  { id: 'm3', title: 'Пхукет: пляжи и экскурсии', country: 'Таиланд', startDate: '2026-12-05', nights: 12, price: 118000, seats: 12, seatsBooked: 9 },
  { id: 'm4', title: 'Тбилиси и Кахетия', country: 'Грузия', startDate: '2026-11-08', nights: 5, price: 38700, seats: 25, seatsBooked: 3 },
  { id: 'm5', title: 'Мальдивы: отель на воде', country: 'Мальдивы', startDate: '2026-12-20', nights: 9, price: 245000, seats: 6, seatsBooked: 6 },
  { id: 'm6', title: 'Дубай: шопинг и пустыня', country: 'ОАЭ', startDate: '2026-12-12', nights: 6, price: 89900, seats: 18, seatsBooked: 7 },
];

interface MockOptions {
  seed?: readonly Tour[];
  delayMs?: number;
  /** Подставьте ошибку, чтобы проверить состояния error в интерфейсе. */
  failWith?: ApiError | null;
}

/** In-memory реализация API: данные живут, пока открыта страница. */
export function createMockToursApi(options: MockOptions = {}): ToursApi {
  const { seed = MOCK_SEED, delayMs = 400 } = options;
  let tours: Tour[] = seed.map((t) => ({ ...t }));
  let bookings: Booking[] = [];
  let nextId = 1;

  const guard = async (): Promise<void> => {
    await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
    if (options.failWith) throw options.failWith;
  };

  const adjustSeats = (tourId: string, delta: number): void => {
    tours = tours.map((t) => (t.id === tourId ? { ...t, seatsBooked: t.seatsBooked + delta } : t));
  };

  return {
    async listTours() {
      await guard();
      return tours.map((t) => ({ ...t }));
    },
    async createTour(input: NewTour) {
      await guard();
      const created: Tour = {
        id: `mock-tour-${nextId++}`,
        title: input.title.trim(),
        country: input.country.trim(),
        startDate: input.startDate,
        nights: input.nights,
        price: input.price,
        seats: input.seats,
        seatsBooked: 0,
      };
      tours = [...tours, created];
      return { ...created };
    },
    async removeTour(id) {
      await guard();
      if (!tours.some((t) => t.id === id)) throw new ApiError('not-found', 404);
      tours = tours.filter((t) => t.id !== id);
      // Как в БД: бронирования удалённого тура удаляются каскадом
      bookings = bookings.filter((b) => b.tourId !== id);
    },
    async listBookings() {
      await guard();
      return bookings.map((b) => ({ ...b }));
    },
    async book(tourId, guests) {
      await guard();
      const tour = tours.find((t) => t.id === tourId);
      if (!tour) throw new ApiError('not-found', 404);
      if (checkBooking(tour, guests) !== null) throw new ApiError('sold-out', 400);
      const booking: Booking = {
        id: `mock-booking-${nextId++}`,
        tourId,
        guests,
        createdAt: new Date().toISOString(),
      };
      bookings = [booking, ...bookings];
      adjustSeats(tourId, guests);
      return { ...booking };
    },
    async cancelBooking(id) {
      await guard();
      const found = bookings.find((b) => b.id === id);
      if (!found) throw new ApiError('not-found', 404);
      bookings = bookings.filter((b) => b.id !== id);
      adjustSeats(found.tourId, -found.guests);
    },
  };
}
