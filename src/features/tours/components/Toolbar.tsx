// path: src/features/tours/components/Toolbar.tsx
import { ALL_COUNTRIES } from '../selectors.logic';

export type PageView = 'catalog' | 'bookings';

interface ToolbarProps {
  countries: string[];
  country: string;
  onCountryChange: (country: string) => void;
  view: PageView;
  onViewChange: (view: PageView) => void;
  bookingsCount: number;
}

export function Toolbar({ countries, country, onCountryChange, view, onViewChange, bookingsCount }: ToolbarProps) {
  const views: { value: PageView; label: string }[] = [
    { value: 'catalog', label: 'Каталог' },
    { value: 'bookings', label: `Мои брони (${bookingsCount})` },
  ];

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      {view === 'catalog' ? (
        <div className="sm:w-64">
          <label htmlFor="country-filter" className="text-sm font-medium text-slate-800">
            Фильтр по стране
          </label>
          <select
            id="country-filter"
            value={country}
            onChange={(e) => onCountryChange(e.target.value)}
            className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-base"
          >
            <option value={ALL_COUNTRIES}>Все страны</option>
            {countries.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <div />
      )}

      <div role="group" aria-label="Раздел" className="grid grid-cols-2 gap-1 rounded-lg bg-slate-200 p-1 sm:w-auto">
        {views.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            aria-pressed={view === value}
            onClick={() => onViewChange(value)}
            className={`min-h-11 rounded-md px-3 text-sm font-medium ${
              view === value ? 'bg-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
