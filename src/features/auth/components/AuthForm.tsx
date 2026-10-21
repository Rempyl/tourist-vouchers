// path: src/features/auth/components/AuthForm.tsx
import { useState, type FormEvent } from 'react';
import { toApiError, type ApiError } from '../../../shared/api/apiError';
import type { AuthApi } from '../api/authApi';

const MIN_PASSWORD = 6;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Mode = 'signIn' | 'signUp';

function describeError(error: ApiError, mode: Mode): string {
  if (error.kind === 'unauthorized') return 'Неверная почта или пароль.';
  if (error.kind === 'validation' && mode === 'signUp') {
    return `Не удалось зарегистрироваться. Проверьте почту; пароль — минимум ${MIN_PASSWORD} символов.`;
  }
  return error.message;
}

export function AuthForm({ auth }: { auth: AuthApi }) {
  const [mode, setMode] = useState<Mode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    if (!EMAIL_PATTERN.test(email.trim())) {
      setError('Введите корректную почту.');
      return;
    }
    if (password.length < MIN_PASSWORD) {
      setError(`Пароль: минимум ${MIN_PASSWORD} символов.`);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      if (mode === 'signIn') {
        await auth.signIn(email.trim(), password);
      } else {
        const result = await auth.signUp(email.trim(), password);
        setMessage(
          result.needsConfirmation
            ? 'Мы отправили письмо для подтверждения. Перейдите по ссылке, затем войдите.'
            : 'Регистрация прошла успешно.',
        );
      }
    } catch (e) {
      setError(describeError(toApiError(e), mode));
    } finally {
      setBusy(false);
    }
  };

  const inputClass =
    'mt-1 block min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-base focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-300';

  return (
    <form onSubmit={handleSubmit} noValidate className="mx-auto grid max-w-sm gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold">{mode === 'signIn' ? 'Вход' : 'Регистрация'}</h2>
      <div>
        <label htmlFor="email" className="text-sm font-medium">
          Почта
        </label>
        <input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
      </div>
      <div>
        <label htmlFor="password" className="text-sm font-medium">
          Пароль
        </label>
        <input
          id="password"
          type="password"
          autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputClass}
        />
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="text-sm text-emerald-700">
          {message}
        </p>
      )}
      <button type="submit" disabled={busy} className="min-h-11 rounded-lg bg-slate-900 px-4 text-base font-medium text-white hover:bg-slate-700 disabled:opacity-50">
        {busy ? 'Подождите…' : mode === 'signIn' ? 'Войти' : 'Зарегистрироваться'}
      </button>
      <button
        type="button"
        onClick={() => {
          setMode(mode === 'signIn' ? 'signUp' : 'signIn');
          setError(null);
          setMessage(null);
        }}
        className="min-h-11 text-sm font-medium text-slate-700 underline"
      >
        {mode === 'signIn' ? 'Нет аккаунта? Зарегистрироваться' : 'Уже есть аккаунт? Войти'}
      </button>
    </form>
  );
}
