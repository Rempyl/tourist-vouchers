// path: src/features/tours/components/TourCard.tsx
import { useState } from 'react';
import { getBookingTotal, getGuestOptions, getSeatsLeft } from '../booking.logic';
import { formatDateRange, formatGuests, formatNights, formatPrice, formatSeats } from '../format.logic';
import type { Tour } from '../types/tour';

interface TourCardProps {
  tour: Tour;
  busy: boolean;
  onBook: (tourId: string, guests: number) => void;
  onRemove: (id: string) => void;
}

export function TourCard({ tour, busy, onBook, onRemove }: TourCardProps) {
  const [guests, setGuests] = useState(1);
  const options = getGuestOptions(tour);
  const soldOut = getSeatsLeft(tour) === 0;
  // Если мест стало меньше выбранного числа гостей, берём максимум из доступного
  const selected = Math.min(guests, options.length || 1);

  return (
    <li className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm" aria-busy={busy}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="break-words text-base font-semibold leading-snug">{tour.title}</h3>
          <p className="mt-1 text-sm text-slate-600">{tour.country}</p>
        </div>
        <span
          className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${
            soldOut ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'
          }`}
        >
          {formatSeats(tour)}
        </span>
      </div>

      <p className="mt-3 text-sm text-slate-700">
        <span className="font-medium">{formatDateRange(tour.startDate, tour.nights)}</span>
        <span className="text-slate-500"> · {formatNights(tour.nights)}</span>
      </p>
      <p className="mt-1 text-lg font-semibold">
        {formatPrice(tour.price)} <span className="text-sm font-normal text-slate-500">за человека</span>
      </p>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
        {!soldOut && (
          <div className="sm:w-32">
            <label htmlFor={`guests-${tour.id}`} className="text-sm font-medium text-slate-800">
              Гостей
            </label>
            <select
              id={`guests-${tour.id}`}
              value={selected}
              disabled={busy}
              aria-label={`Гостей: ${tour.title}`}
              onChange={(e) => setGuests(Number(e.target.value))}
              className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-base"
            >
              {options.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        )}
        <button
          type="button"
          disabled={busy || soldOut}
          onClick={() => onBook(tour.id, selected)}
          aria-label={`Забронировать: ${tour.title}`}
          className="min-h-11 rounded-lg bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {soldOut ? 'Мест нет' : `Забронировать (${formatPrice(getBookingTotal(tour, selected))}, ${formatGuests(selected)})`}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => onRemove(tour.id)}
          aria-label={`Удалить: ${tour.title}`}
          className="min-h-11 rounded-lg border border-slate-300 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          Удалить
        </button>
      </div>
    </li>
  );
}
