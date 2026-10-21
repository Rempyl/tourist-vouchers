// path: src/features/tours/api/supabaseToursApi.ts
import type { SupabaseClient } from '@supabase/supabase-js';
import { ApiError, kindFromStatus } from '../../../shared/api/apiError';
import { log } from '../../../shared/api/logger';
import type { Booking, NewTour, Tour } from '../types/tour';
import type { ToursApi } from './toursApi';

const TOURS_TABLE = 'tours';
const BOOKINGS_TABLE = 'bookings';
const TOUR_COLUMNS = 'id,title,country,start_date,nights,price,seats,seats_booked';
const BOOKING_COLUMNS = 'id,tour_id,guests,created_at';

/** Check-ограничение БД: seats_booked не может превысить seats (срабатывает при нехватке мест). */
const SEATS_CONSTRAINT = 'tours_seats_booked_range';
const CHECK_VIOLATION = '23514';

/** Строка таблицы tours в том виде, как её отдаёт PostgREST. */
interface TourRow {
  id: string;
  title: string;
  country: string;
  start_date: string;
  nights: number;
  price: number;
  seats: number;
  seats_booked: number;
}

interface BookingRow {
  id: string;
  tour_id: string;
  guests: number;
  created_at: string;
}

export function rowToTour(row: TourRow): Tour {
  return {
    id: row.id,
    title: row.title,
    country: row.country,
    startDate: row.start_date,
    nights: row.nights,
    price: row.price,
    seats: row.seats,
    seatsBooked: row.seats_booked,
  };
}

export function rowToBooking(row: BookingRow): Booking {
  return { id: row.id, tourId: row.tour_id, guests: row.guests, createdAt: row.created_at };
}

interface SupabaseFailure {
  message: string;
  code?: string;
}

/** Превращает ответ Supabase с ошибкой в ApiError и пишет её в лог. */
export function failureToApiError(context: string, failure: SupabaseFailure, status: number | null): ApiError {
  const soldOut = failure.code === CHECK_VIOLATION && failure.message.includes(SEATS_CONSTRAINT);
  const kind = soldOut ? 'sold-out' : kindFromStatus(status);
  const apiError = new ApiError(kind, status, { cause: failure });
  log('error', context, apiError.kind, { status, code: failure.code ?? null, detail: failure.message });
  return apiError;
}

export function createSupabaseToursApi(client: SupabaseClient): ToursApi {
  return {
    async listTours() {
      const { data, error, status } = await client
        .from(TOURS_TABLE)
        .select(TOUR_COLUMNS)
        .order('start_date', { ascending: true });
      if (error) throw failureToApiError('tours.list', error, status);
      return (data as TourRow[]).map(rowToTour);
    },

    async createTour(input: NewTour) {
      // author_id подставляет БД (default auth.uid()), seats_booked тоже ведёт БД: с клиента их не отправляем
      const { data, error, status } = await client
        .from(TOURS_TABLE)
        .insert({
          title: input.title.trim(),
          country: input.country.trim(),
          start_date: input.startDate,
          nights: input.nights,
          price: input.price,
          seats: input.seats,
        })
        .select(TOUR_COLUMNS)
        .single();
      if (error) throw failureToApiError('tours.create', error, status);
      return rowToTour(data as TourRow);
    },

    async removeTour(id) {
      const { data, error, status } = await client.from(TOURS_TABLE).delete().eq('id', id).select('id');
      if (error) throw failureToApiError('tours.remove', error, status);
      // RLS не возвращает ошибку, а «не видит» чужие строки: 0 удалённых строк = нет прав или нет записи
      if ((data as { id: string }[]).length === 0) {
        log('warning', 'tours.remove', 'no rows affected', { id });
        throw new ApiError('forbidden', 403);
      }
    },

    async listBookings() {
      const { data, error, status } = await client
        .from(BOOKINGS_TABLE)
        .select(BOOKING_COLUMNS)
        .order('created_at', { ascending: false });
      if (error) throw failureToApiError('bookings.list', error, status);
      return (data as BookingRow[]).map(rowToBooking);
    },

    async book(tourId, guests) {
      // user_id подставляет БД (default auth.uid()); занятые места пересчитывает триггер
      const { data, error, status } = await client
        .from(BOOKINGS_TABLE)
        .insert({ tour_id: tourId, guests })
        .select(BOOKING_COLUMNS)
        .single();
      if (error) throw failureToApiError('bookings.create', error, status);
      return rowToBooking(data as BookingRow);
    },

    async cancelBooking(id) {
      const { data, error, status } = await client.from(BOOKINGS_TABLE).delete().eq('id', id).select('id');
      if (error) throw failureToApiError('bookings.cancel', error, status);
      if ((data as { id: string }[]).length === 0) {
        log('warning', 'bookings.cancel', 'no rows affected', { id });
        throw new ApiError('forbidden', 403);
      }
    },
  };
}
