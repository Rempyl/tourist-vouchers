// path: src/features/tours/hooks/useTours.ts
import { useCallback, useEffect, useRef, useState } from 'react';
import { toApiError, type ApiError } from '../../../shared/api/apiError';
import type { ToursApi } from '../api/toursApi';
import type { Booking, NewTour, Tour } from '../types/tour';

export type LoadStatus = 'loading' | 'error' | 'success';

export interface UseTours {
  status: LoadStatus;
  tours: Tour[];
  bookings: Booking[];
  /** Ошибка загрузки (показывается вместо списка). */
  loadError: ApiError | null;
  /** Ошибка последнего действия: создание, бронь, отмена, удаление (показывается над списком). */
  actionError: ApiError | null;
  /** Id туров и бронирований, по которым сейчас идёт запрос. */
  busyIds: ReadonlySet<string>;
  creating: boolean;
  reload: () => Promise<void>;
  createTour: (input: NewTour) => Promise<boolean>;
  removeTour: (id: string) => Promise<void>;
  book: (tourId: string, guests: number) => Promise<boolean>;
  cancelBooking: (id: string) => Promise<void>;
  dismissActionError: () => void;
}

export function useTours(api: ToursApi): UseTours {
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [tours, setTours] = useState<Tour[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loadError, setLoadError] = useState<ApiError | null>(null);
  const [actionError, setActionError] = useState<ApiError | null>(null);
  const [busyIds, setBusyIds] = useState<ReadonlySet<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const mounted = useRef(true);

  const fetchAll = useCallback(async () => {
    try {
      const [loadedTours, loadedBookings] = await Promise.all([api.listTours(), api.listBookings()]);
      if (!mounted.current) return;
      setTours(loadedTours);
      setBookings(loadedBookings);
      setStatus('success');
    } catch (error) {
      if (!mounted.current) return;
      setLoadError(toApiError(error));
      setStatus('error');
    }
  }, [api]);

  /** Повторная загрузка по кнопке «Повторить»: сначала возвращает состояние загрузки. */
  const reload = useCallback(async () => {
    setStatus('loading');
    setLoadError(null);
    await fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    mounted.current = true;
    void fetchAll();
    return () => {
      mounted.current = false;
    };
  }, [fetchAll]);

  /** Выполняет действие над записью: блокирует её кнопки и превращает любую ошибку в actionError. */
  const withBusy = useCallback(async (id: string, action: () => Promise<void>): Promise<boolean> => {
    setActionError(null);
    setBusyIds((prev) => new Set(prev).add(id));
    try {
      await action();
      return true;
    } catch (error) {
      if (mounted.current) setActionError(toApiError(error));
      return false;
    } finally {
      if (mounted.current) {
        setBusyIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    }
  }, []);

  const adjustSeats = useCallback((tourId: string, delta: number) => {
    setTours((prev) => prev.map((t) => (t.id === tourId ? { ...t, seatsBooked: t.seatsBooked + delta } : t)));
  }, []);

  /** Мест могло стать меньше, чем мы думали: тихо подтягиваем свежие данные. */
  const refreshTours = useCallback(async () => {
    try {
      const fresh = await api.listTours();
      if (mounted.current) setTours(fresh);
    } catch {
      // Ошибка действия уже показана пользователю; список обновится при следующей загрузке
    }
  }, [api]);

  const createTour = useCallback(
    async (input: NewTour): Promise<boolean> => {
      setActionError(null);
      setCreating(true);
      try {
        const created = await api.createTour(input);
        if (mounted.current) setTours((prev) => [...prev, created]);
        return true;
      } catch (error) {
        if (mounted.current) setActionError(toApiError(error));
        return false;
      } finally {
        if (mounted.current) setCreating(false);
      }
    },
    [api],
  );

  const removeTour = useCallback(
    async (id: string) => {
      await withBusy(id, async () => {
        await api.removeTour(id);
        if (!mounted.current) return;
        setTours((prev) => prev.filter((t) => t.id !== id));
        // Бронирования удалённого тура исчезают вместе с ним (каскад в БД)
        setBookings((prev) => prev.filter((b) => b.tourId !== id));
      });
    },
    [api, withBusy],
  );

  const book = useCallback(
    async (tourId: string, guests: number): Promise<boolean> => {
      let soldOut = false;
      const ok = await withBusy(tourId, async () => {
        try {
          const booking = await api.book(tourId, guests);
          if (!mounted.current) return;
          setBookings((prev) => [booking, ...prev]);
          adjustSeats(tourId, guests);
        } catch (error) {
          soldOut = toApiError(error).kind === 'sold-out';
          throw error;
        }
      });
      if (soldOut) await refreshTours();
      return ok;
    },
    [api, withBusy, adjustSeats, refreshTours],
  );

  const cancelBooking = useCallback(
    async (id: string) => {
      await withBusy(id, async () => {
        await api.cancelBooking(id);
        if (!mounted.current) return;
        const cancelled = bookings.find((b) => b.id === id);
        setBookings((prev) => prev.filter((b) => b.id !== id));
        if (cancelled) adjustSeats(cancelled.tourId, -cancelled.guests);
      });
    },
    [api, withBusy, adjustSeats, bookings],
  );

  const dismissActionError = useCallback(() => setActionError(null), []);

  return {
    status,
    tours,
    bookings,
    loadError,
    actionError,
    busyIds,
    creating,
    reload,
    createTour,
    removeTour,
    book,
    cancelBooking,
    dismissActionError,
  };
}
