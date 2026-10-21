// path: src/features/tours/components/TourForm.tsx
import { useState, type FormEvent } from 'react';
import { toNewTour, validateTourForm, type TourFormErrors } from '../validation.logic';
import type { NewTour, TourFormValues } from '../types/tour';

interface TourFormProps {
  /** Возвращает true, если тур создан (тогда форма очищается). */
  onSubmit: (input: NewTour) => Promise<boolean>;
  submitting: boolean;
}

const EMPTY: TourFormValues = { title: '', country: '', startDate: '', nights: '', price: '', seats: '' };

const INPUT_CLASS =
  'mt-1 block min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-base focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-300';

export function TourForm({ onSubmit, submitting }: TourFormProps) {
  const [values, setValues] = useState<TourFormValues>(EMPTY);
  const [errors, setErrors] = useState<TourFormErrors>({});

  const handleChange = (field: keyof TourFormValues, value: string) => {
    setValues((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const found = validateTourForm(values);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    const created = await onSubmit(toNewTour(values));
    if (created) setValues(EMPTY);
  };

  const field = (name: keyof TourFormValues, label: string, type: string, placeholder?: string) => {
    const error = errors[name];
    const errorId = `${name}-error`;
    return (
      <div>
        <label htmlFor={name} className="text-sm font-medium text-slate-800">
          {label}
        </label>
        <input
          id={name}
          name={name}
          type={type}
          inputMode={type === 'number' ? 'numeric' : undefined}
          value={values[name]}
          placeholder={placeholder}
          onChange={(e) => handleChange(name, e.target.value)}
          aria-invalid={error !== undefined}
          aria-describedby={error ? errorId : undefined}
          className={`${INPUT_CLASS} ${error ? 'border-red-500' : ''}`}
        />
        {error && (
          <p id={errorId} className="mt-1 text-sm text-red-700">
            {error}
          </p>
        )}
      </div>
    );
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="grid gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-lg font-semibold">Новая путёвка</h2>
      {field('title', 'Название', 'text', 'Например, Анталья: всё включено')}
      {field('country', 'Страна', 'text', 'Например, Турция')}
      {field('startDate', 'Дата вылета', 'date')}
      <div className="grid grid-cols-2 gap-3">
        {field('nights', 'Ночей', 'number', '7')}
        {field('seats', 'Мест', 'number', '20')}
      </div>
      {field('price', 'Цена за человека, ₽', 'number', '54900')}
      <button
        type="submit"
        disabled={submitting}
        className="min-h-11 rounded-lg bg-slate-900 px-4 text-base font-medium text-white hover:bg-slate-700 disabled:opacity-50"
      >
        {submitting ? 'Добавляем…' : 'Добавить'}
      </button>
    </form>
  );
}
