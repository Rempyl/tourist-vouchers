// path: src/features/tours/components/ToursPage.test.tsx
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ApiError } from '../../../shared/api/apiError';
import { createMockToursApi } from '../api/mockToursApi';
import type { Tour } from '../types/tour';
import { ToursPage } from './ToursPage';

const tour = (overrides: Partial<Tour> & Pick<Tour, 'id' | 'title'>): Tour => ({
  country: 'Турция',
  startDate: '2026-11-14',
  nights: 7,
  price: 50000,
  seats: 10,
  seatsBooked: 0,
  ...overrides,
});

const SEED: Tour[] = [
  tour({ id: 't1', title: 'Анталья', seatsBooked: 8 }),
  tour({ id: 't2', title: 'Хургада', country: 'Египет', startDate: '2026-11-10' }),
  tour({ id: 't3', title: 'Мальдивы', country: 'Мальдивы', seats: 6, seatsBooked: 6 }),
];

const setup = (seed: Tour[] = SEED) => render(<ToursPage api={createMockToursApi({ seed, delayMs: 0 })} />);

describe('ToursPage', () => {
  it('показывает загрузку, затем каталог с ближайшим вылетом первым', async () => {
    setup();
    expect(screen.getByRole('status')).toHaveTextContent('Загружаем путёвки');
    const items = await screen.findAllByRole('listitem');
    expect(items[0]).toHaveTextContent('Хургада');
    expect(items).toHaveLength(3);
  });

  it('пустой каталог: подсказка добавить первую путёвку', async () => {
    setup([]);
    expect(await screen.findByText(/Пока нет путёвок/)).toBeInTheDocument();
  });

  it('ошибка загрузки: сообщение и повтор', async () => {
    render(<ToursPage api={createMockToursApi({ seed: SEED, delayMs: 0, failWith: new ApiError('network') })} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Нет соединения');
    expect(screen.getByRole('button', { name: 'Повторить' })).toBeInTheDocument();
  });

  it('фильтр по стране оставляет только её туры', async () => {
    setup();
    await screen.findByText('Хургада');
    await userEvent.selectOptions(screen.getByLabelText('Фильтр по стране'), 'Египет');
    expect(screen.getByText('Хургада')).toBeInTheDocument();
    expect(screen.queryByText('Анталья')).not.toBeInTheDocument();
  });

  it('тур без мест: кнопка недоступна, бронировать нельзя', async () => {
    setup();
    await screen.findByRole('heading', { name: 'Мальдивы' });
    expect(screen.getByRole('button', { name: 'Забронировать: Мальдивы' })).toBeDisabled();
    expect(screen.queryByLabelText('Гостей: Мальдивы')).not.toBeInTheDocument();
  });

  it('бронирование: уменьшает число мест и появляется в «Мои брони»', async () => {
    setup();
    await screen.findByText('Анталья');
    await userEvent.selectOptions(screen.getByLabelText('Гостей: Анталья'), '2');
    await userEvent.click(screen.getByRole('button', { name: 'Забронировать: Анталья' }));

    // Было 2 свободных места из 10, забронировали оба
    expect(await screen.findByRole('button', { name: 'Мои брони (1)' })).toBeInTheDocument();
    expect(screen.getAllByText('Мест нет').length).toBeGreaterThan(0);

    await userEvent.click(screen.getByRole('button', { name: 'Мои брони (1)' }));
    const booking = screen.getByRole('listitem');
    expect(booking).toHaveTextContent('Анталья');
    expect(booking).toHaveTextContent('2 гостя');
    expect(booking).toHaveTextContent('итого 100 000 ₽');
  });

  it('отмена брони возвращает места', async () => {
    setup();
    await screen.findByText('Анталья');
    await userEvent.click(screen.getByRole('button', { name: 'Забронировать: Анталья' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Мои брони (1)' }));
    await userEvent.click(screen.getByRole('button', { name: 'Отменить бронь: Анталья' }));

    expect(await screen.findByText(/пока нет бронирований/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Каталог' }));
    expect(screen.getByText('Осталось 2 из 10 мест')).toBeInTheDocument();
  });

  it('добавление тура через форму: тур появляется в каталоге', async () => {
    setup([]);
    await screen.findByText(/Пока нет путёвок/);
    await userEvent.type(screen.getByLabelText('Название'), 'Тбилиси');
    await userEvent.type(screen.getByLabelText('Страна'), 'Грузия');
    await userEvent.type(screen.getByLabelText('Дата вылета'), '2026-11-08');
    await userEvent.type(screen.getByLabelText('Ночей'), '5');
    await userEvent.type(screen.getByLabelText('Мест'), '25');
    await userEvent.type(screen.getByLabelText('Цена за человека, ₽'), '38700');
    await userEvent.click(screen.getByRole('button', { name: 'Добавить' }));

    const card = await screen.findByRole('listitem');
    expect(within(card).getByText('Тбилиси')).toBeInTheDocument();
    expect(card).toHaveTextContent('38 700 ₽');
    expect(card).toHaveTextContent('Осталось 25 из 25 мест');
  });

  it('удаление тура убирает его из каталога', async () => {
    setup();
    await screen.findByText('Анталья');
    await userEvent.click(screen.getByRole('button', { name: 'Удалить: Анталья' }));
    expect(screen.queryByText('Анталья')).not.toBeInTheDocument();
  });
});
