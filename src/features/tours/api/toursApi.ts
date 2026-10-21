// path: src/features/tours/api/toursApi.ts
import type { Booking, NewTour, Tour } from '../types/tour';

/** Контракт слоя данных. Реализации: mock (разработка/тесты) и Supabase (боевая). */
export interface ToursApi {
  listTours(): Promise<Tour[]>;
  createTour(input: NewTour): Promise<Tour>;
  removeTour(id: string): Promise<void>;
  /** Бронирования текущего пользователя. */
  listBookings(): Promise<Booking[]>;
  /** Бронирует места; если свободных мест не хватает, бросает ApiError('sold-out'). */
  book(tourId: string, guests: number): Promise<Booking>;
  cancelBooking(id: string): Promise<void>;
}
