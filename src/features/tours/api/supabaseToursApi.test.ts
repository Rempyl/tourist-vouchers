// path: src/features/tours/api/supabaseToursApi.test.ts
import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { createSupabaseToursApi, rowToBooking, rowToTour } from './supabaseToursApi';

interface FakeResponse {
  data: unknown;
  error: { message: string; code?: string } | null;
  status: number;
}

/** Минимальная имитация цепочки supabase-js: любой метод возвращает ту же цепочку, await даёт ответ. */
function fakeClient(response: FakeResponse): { client: SupabaseClient; calls: string[] } {
  const calls: string[] = [];
  const chain: Record<string, unknown> = {};
  const handler = (name: string) =>
    vi.fn((...args: unknown[]) => {
      calls.push(`${name}(${args.map((a) => JSON.stringify(a)).join(',')})`);
      return chain;
    });
  for (const name of ['select', 'insert', 'update', 'delete', 'eq', 'order', 'single']) chain[name] = handler(name);
  chain.then = (resolve: (value: FakeResponse) => unknown) => resolve(response);
  const client = { from: vi.fn(() => chain) } as unknown as SupabaseClient;
  return { client, calls };
}

const TOUR_ROW = {
  id: 't1',
  title: 'Анталья',
  country: 'Турция',
  start_date: '2026-11-14',
  nights: 7,
  price: 54900,
  seats: 20,
  seats_booked: 12,
};
const TOUR = {
  id: 't1',
  title: 'Анталья',
  country: 'Турция',
  startDate: '2026-11-14',
  nights: 7,
  price: 54900,
  seats: 20,
  seatsBooked: 12,
};
const BOOKING_ROW = { id: 'b1', tour_id: 't1', guests: 2, created_at: '2026-10-20T10:00:00Z' };

describe('преобразование строк', () => {
  it('rowToTour: snake_case из БД в camelCase', () => {
    expect(rowToTour(TOUR_ROW)).toEqual(TOUR);
  });
  it('rowToBooking: snake_case из БД в camelCase', () => {
    expect(rowToBooking(BOOKING_ROW)).toEqual({ id: 'b1', tourId: 't1', guests: 2, createdAt: '2026-10-20T10:00:00Z' });
  });
});

describe('createSupabaseToursApi: туры', () => {
  it('listTours: возвращает преобразованные строки', async () => {
    const { client } = fakeClient({ data: [TOUR_ROW], error: null, status: 200 });
    expect(await createSupabaseToursApi(client).listTours()).toEqual([TOUR]);
  });

  it('createTour: не отправляет author_id и seats_booked, обрезает пробелы', async () => {
    const { client, calls } = fakeClient({ data: TOUR_ROW, error: null, status: 201 });
    await createSupabaseToursApi(client).createTour({
      title: ' Анталья ',
      country: ' Турция ',
      startDate: '2026-11-14',
      nights: 7,
      price: 54900,
      seats: 20,
    });
    const insertCall = calls.find((c) => c.startsWith('insert'));
    expect(insertCall).toBeDefined();
    expect(insertCall).not.toContain('author_id');
    expect(insertCall).not.toContain('seats_booked');
    expect(insertCall).toContain('"title":"Анталья"');
    expect(insertCall).toContain('"start_date":"2026-11-14"');
  });

  it('listTours: 401 → unauthorized, 500 → server, status 0 → network', async () => {
    const unauthorized = fakeClient({ data: null, error: { message: 'JWT expired', code: 'PGRST301' }, status: 401 });
    await expect(createSupabaseToursApi(unauthorized.client).listTours()).rejects.toMatchObject({ kind: 'unauthorized' });
    const server = fakeClient({ data: null, error: { message: 'boom' }, status: 500 });
    await expect(createSupabaseToursApi(server.client).listTours()).rejects.toMatchObject({ kind: 'server' });
    const network = fakeClient({ data: null, error: { message: 'Failed to fetch' }, status: 0 });
    await expect(createSupabaseToursApi(network.client).listTours()).rejects.toMatchObject({ kind: 'network' });
  });

  it('removeTour: 0 удалённых строк (чужой тур под RLS) = forbidden', async () => {
    const { client } = fakeClient({ data: [], error: null, status: 200 });
    await expect(createSupabaseToursApi(client).removeTour('t1')).rejects.toMatchObject({ kind: 'forbidden' });
  });
});

describe('createSupabaseToursApi: бронирования', () => {
  it('listBookings: возвращает преобразованные строки', async () => {
    const { client } = fakeClient({ data: [BOOKING_ROW], error: null, status: 200 });
    const result = await createSupabaseToursApi(client).listBookings();
    expect(result).toEqual([{ id: 'b1', tourId: 't1', guests: 2, createdAt: '2026-10-20T10:00:00Z' }]);
  });

  it('book: не отправляет user_id', async () => {
    const { client, calls } = fakeClient({ data: BOOKING_ROW, error: null, status: 201 });
    await createSupabaseToursApi(client).book('t1', 2);
    const insertCall = calls.find((c) => c.startsWith('insert'));
    expect(insertCall).toContain('"tour_id":"t1"');
    expect(insertCall).toContain('"guests":2');
    expect(insertCall).not.toContain('user_id');
  });

  it('book: нарушение tours_seats_booked_range = sold-out', async () => {
    const { client } = fakeClient({
      data: null,
      error: {
        message: 'new row for relation "tours" violates check constraint "tours_seats_booked_range"',
        code: '23514',
      },
      status: 400,
    });
    await expect(createSupabaseToursApi(client).book('t1', 5)).rejects.toMatchObject({ kind: 'sold-out' });
  });

  it('book: другая проверка (например, число гостей) остаётся validation', async () => {
    const { client } = fakeClient({
      data: null,
      error: { message: 'violates check constraint "bookings_guests_range"', code: '23514' },
      status: 400,
    });
    await expect(createSupabaseToursApi(client).book('t1', 0)).rejects.toMatchObject({ kind: 'validation' });
  });

  it('cancelBooking: 0 затронутых строк (чужая бронь под RLS) = forbidden', async () => {
    const { client } = fakeClient({ data: [], error: null, status: 200 });
    await expect(createSupabaseToursApi(client).cancelBooking('b1')).rejects.toMatchObject({ kind: 'forbidden' });
  });
});
