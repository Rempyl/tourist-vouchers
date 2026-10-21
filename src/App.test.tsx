// path: src/App.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import App from './App';
import { ApiError } from './shared/api/apiError';
import type { AuthApi, AuthUser } from './features/auth/api/authApi';
import { createMockToursApi } from './features/tours/api/mockToursApi';

const USER: AuthUser = { id: 'u1', email: 'rem@example.com' };

function fakeAuth(overrides: Partial<AuthApi> = {}): AuthApi {
  return {
    getUser: () => Promise.resolve(null),
    signIn: () => Promise.resolve(USER),
    signUp: () => Promise.resolve({ needsConfirmation: true }),
    signOut: () => Promise.resolve(),
    onChange: () => () => undefined,
    ...overrides,
  };
}

const tours = createMockToursApi({ seed: [], delayMs: 0 });

describe('App: авторизация', () => {
  it('без входа показывает форму входа, а не каталог', async () => {
    render(<App services={{ tours, auth: fakeAuth() }} />);
    expect(await screen.findByRole('heading', { name: 'Вход' })).toBeInTheDocument();
    expect(screen.queryByText('Новая путёвка')).not.toBeInTheDocument();
  });

  it('неверный пароль: показывает понятную ошибку', async () => {
    const signIn = vi.fn().mockRejectedValue(new ApiError('unauthorized', 400));
    render(<App services={{ tours, auth: fakeAuth({ signIn }) }} />);

    await userEvent.type(await screen.findByLabelText('Почта'), 'rem@example.com');
    await userEvent.type(screen.getByLabelText('Пароль'), 'wrong-password');
    await userEvent.click(screen.getByRole('button', { name: 'Войти' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Неверная почта или пароль');
  });

  it('регистрация: лимит запросов (429) объясняется, а не выдаётся за ошибку сервера', async () => {
    const signUp = vi.fn().mockRejectedValue(new ApiError('rate-limit', 429));
    render(<App services={{ tours, auth: fakeAuth({ signUp }) }} />);

    await userEvent.click(await screen.findByRole('button', { name: 'Нет аккаунта? Зарегистрироваться' }));
    await userEvent.type(screen.getByLabelText('Почта'), 'rem@example.com');
    await userEvent.type(screen.getByLabelText('Пароль'), 'secret123');
    await userEvent.click(screen.getByRole('button', { name: 'Зарегистрироваться' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Слишком много запросов');
    expect(alert).not.toHaveTextContent('Ошибка на сервере');
  });

  it('клиентская валидация: короткий пароль не уходит на сервер', async () => {
    const signIn = vi.fn();
    render(<App services={{ tours, auth: fakeAuth({ signIn }) }} />);

    await userEvent.type(await screen.findByLabelText('Почта'), 'rem@example.com');
    await userEvent.type(screen.getByLabelText('Пароль'), '123');
    await userEvent.click(screen.getByRole('button', { name: 'Войти' }));

    expect(signIn).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('минимум 6 символов');
  });

  it('с активной сессией показывает приложение и почту пользователя', async () => {
    render(<App services={{ tours, auth: fakeAuth({ getUser: () => Promise.resolve(USER) }) }} />);
    expect(await screen.findByText('Новая путёвка')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Выйти' })).toBeInTheDocument();
  });

  it('без auth (режим mock) приложение открыто сразу', async () => {
    render(<App services={{ tours }} />);
    expect(await screen.findByText('Новая путёвка')).toBeInTheDocument();
  });
});
