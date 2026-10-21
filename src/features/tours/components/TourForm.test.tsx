// path: src/features/tours/components/TourForm.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TourForm } from './TourForm';

async function fillValid() {
  await userEvent.type(screen.getByLabelText('Название'), 'Анталья');
  await userEvent.type(screen.getByLabelText('Страна'), 'Турция');
  await userEvent.type(screen.getByLabelText('Дата вылета'), '2026-11-14');
  await userEvent.type(screen.getByLabelText('Ночей'), '7');
  await userEvent.type(screen.getByLabelText('Мест'), '20');
  await userEvent.type(screen.getByLabelText('Цена за человека, ₽'), '54900');
}

describe('TourForm', () => {
  it('успех: отправляет числа числами и очищает форму', async () => {
    const onSubmit = vi.fn().mockResolvedValue(true);
    render(<TourForm onSubmit={onSubmit} submitting={false} />);

    await fillValid();
    await userEvent.click(screen.getByRole('button', { name: 'Добавить' }));

    expect(onSubmit).toHaveBeenCalledWith({
      title: 'Анталья',
      country: 'Турция',
      startDate: '2026-11-14',
      nights: 7,
      price: 54900,
      seats: 20,
    });
    expect(screen.getByLabelText('Название')).toHaveValue('');
  });

  it('ошибка валидации: не отправляет и показывает сообщения у полей', async () => {
    const onSubmit = vi.fn();
    render(<TourForm onSubmit={onSubmit} submitting={false} />);

    await userEvent.click(screen.getByRole('button', { name: 'Добавить' }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/Название: минимум/)).toBeInTheDocument();
    expect(screen.getByText('Укажите дату вылета')).toBeInTheDocument();
    expect(screen.getByText('Цена: укажите число')).toBeInTheDocument();
    expect(screen.getByLabelText('Название')).toHaveAttribute('aria-invalid', 'true');
  });

  it('если сервер отклонил запрос, введённые данные сохраняются', async () => {
    const onSubmit = vi.fn().mockResolvedValue(false);
    render(<TourForm onSubmit={onSubmit} submitting={false} />);

    await fillValid();
    await userEvent.click(screen.getByRole('button', { name: 'Добавить' }));

    expect(screen.getByLabelText('Название')).toHaveValue('Анталья');
  });
});
