// path: src/features/tours/components/BookingList.tsx
import { getBookingTotal } from '../booking.logic';
import { formatDateRange, formatGuests, formatPrice } from '../format.logic';
import type { Booking, Tour } from '../types/tour';

interface BookingListProps {
  bookings: Booking[];
  tours: Tour[];
  busyIds: ReadonlySet<string>;
  onCancel: (id: string) => void;
}

export function BookingList({ bookings, tours, busyIds, onCancel }: BookingListProps) {
  const toursById = new Map(tours.map((t) => [t.id, t]));

  return (
    <ul className="grid gap-3">
      {bookings.map((booking) => {
        const tour = toursById.get(booking.tourId);
        if (!tour) return null;
        return (
          <li
            key={booking.id}
            aria-busy={busyIds.has(booking.id)}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <h3 className="break-words text-base font-semibold leading-snug">{tour.title}</h3>
            <p className="mt-1 text-sm text-slate-600">
              {tour.country} · {formatDateRange(tour.startDate, tour.nights)}
            </p>
            <p className="mt-3 text-sm text-slate-700">
              <span className="font-medium">{formatGuests(booking.guests)}</span>
              <span className="text-slate-500"> · итого {formatPrice(getBookingTotal(tour, booking.guests))}</span>
            </p>
            <button
              type="button"
              disabled={busyIds.has(booking.id)}
              onClick={() => onCancel(booking.id)}
              aria-label={`Отменить бронь: ${tour.title}`}
              className="mt-4 min-h-11 rounded-lg border border-slate-300 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Отменить бронь
            </button>
          </li>
        );
      })}
    </ul>
  );
}
