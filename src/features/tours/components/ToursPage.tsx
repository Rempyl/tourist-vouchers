// path: src/features/tours/components/ToursPage.tsx
import { useMemo, useState } from 'react';
import { ErrorBanner } from '../../../shared/components/ErrorBanner';
import type { ToursApi } from '../api/toursApi';
import { useTours } from '../hooks/useTours';
import { ALL_COUNTRIES, getCountries, selectVisibleTours } from '../selectors.logic';
import { BookingList } from './BookingList';
import { Toolbar, type PageView } from './Toolbar';
import { TourCard } from './TourCard';
import { TourForm } from './TourForm';

interface ToursPageProps {
  api: ToursApi;
}

export function ToursPage({ api }: ToursPageProps) {
  const {
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
  } = useTours(api);
  const [country, setCountry] = useState(ALL_COUNTRIES);
  const [view, setView] = useState<PageView>('catalog');
  // На узких экранах форма свёрнута, чтобы каталог был виден сразу; на lg+ она всегда на виду
  const [formOpen, setFormOpen] = useState(false);

  const handleCreate = async (input: Parameters<typeof createTour>[0]): Promise<boolean> => {
    const created = await createTour(input);
    if (created) setFormOpen(false);
    return created;
  };

  const countries = useMemo(() => getCountries(tours), [tours]);
  // Если выбранная страна исчезла (удалили последний тур), фильтр сбрасывается
  const activeCountry = countries.includes(country) ? country : ALL_COUNTRIES;
  const visible = useMemo(() => selectVisibleTours(tours, activeCountry), [tours, activeCountry]);
  const myBookings = useMemo(() => bookings.filter((b) => tours.some((t) => t.id === b.tourId)), [bookings, tours]);

  return (
    <div className="grid gap-6 lg:grid-cols-[22rem_1fr] lg:items-start">
      <div className="lg:sticky lg:top-6">
        <button
          type="button"
          aria-expanded={formOpen}
          aria-controls="tour-form-panel"
          onClick={() => setFormOpen((open) => !open)}
          className="min-h-11 w-full rounded-lg bg-slate-900 px-4 text-base font-medium text-white hover:bg-slate-700 lg:hidden"
        >
          {formOpen ? 'Скрыть форму' : '+ Добавить путёвку'}
        </button>
        <div id="tour-form-panel" className={`${formOpen ? 'mt-3 block' : 'hidden'} lg:mt-0 lg:block`}>
          <TourForm onSubmit={handleCreate} submitting={creating} />
        </div>
      </div>

      <section aria-label="Путёвки" className="grid gap-4">
        {actionError && <ErrorBanner error={actionError} onDismiss={dismissActionError} />}

        {status === 'loading' && (
          <p role="status" className="rounded-xl border border-slate-200 bg-white p-6 text-center text-slate-600">
            Загружаем путёвки…
          </p>
        )}

        {status === 'error' && loadError && <ErrorBanner error={loadError} onRetry={() => void reload()} />}

        {status === 'success' && (
          <>
            <Toolbar
              countries={countries}
              country={activeCountry}
              onCountryChange={setCountry}
              view={view}
              onViewChange={setView}
              bookingsCount={myBookings.length}
            />

            {view === 'catalog' &&
              (visible.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-600">
                  {tours.length === 0 ? 'Пока нет путёвок. Добавьте первую через форму.' : 'В этой стране путёвок нет.'}
                </p>
              ) : (
                <ul className="grid gap-3">
                  {visible.map((tour) => (
                    <TourCard
                      key={tour.id}
                      tour={tour}
                      busy={busyIds.has(tour.id)}
                      onBook={(id, guests) => void book(id, guests)}
                      onRemove={(id) => void removeTour(id)}
                    />
                  ))}
                </ul>
              ))}

            {view === 'bookings' &&
              (myBookings.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-600">
                  У вас пока нет бронирований. Выберите тур в каталоге.
                </p>
              ) : (
                <BookingList bookings={myBookings} tours={tours} busyIds={busyIds} onCancel={(id) => void cancelBooking(id)} />
              ))}
          </>
        )}
      </section>
    </div>
  );
}
