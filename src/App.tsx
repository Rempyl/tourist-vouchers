// path: src/App.tsx
import { useEffect, useState } from 'react';
import type { AuthApi, AuthUser } from './features/auth/api/authApi';
import { AuthForm } from './features/auth/components/AuthForm';
import type { ToursApi } from './features/tours/api/toursApi';
import { ToursPage } from './features/tours/components/ToursPage';
import { toApiError } from './shared/api/apiError';
import { log } from './shared/api/logger';

export interface AppServices {
  tours: ToursApi;
  /** Нет auth — приложение работает в открытом режиме (mock-данные для разработки). */
  auth?: AuthApi;
}

interface AppProps {
  services: AppServices;
}

type SessionState = { status: 'checking' } | { status: 'ready'; user: AuthUser | null };

function useSession(auth: AuthApi | undefined): SessionState {
  const [state, setState] = useState<SessionState>(auth ? { status: 'checking' } : { status: 'ready', user: null });

  useEffect(() => {
    if (!auth) return;
    let active = true;
    auth
      .getUser()
      .then((user) => {
        if (active) setState({ status: 'ready', user });
      })
      .catch((error: unknown) => {
        log('error', 'session.init', toApiError(error).kind);
        if (active) setState({ status: 'ready', user: null });
      });
    const unsubscribe = auth.onChange((user) => {
      if (active) setState({ status: 'ready', user });
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [auth]);

  return state;
}

export default function App({ services }: AppProps) {
  const { auth, tours } = services;
  const session = useSession(auth);

  return (
    <div className="mx-auto min-h-screen max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      <header className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">Туристические путёвки</h1>
          <p className="text-sm text-slate-600">Каталог туров и онлайн-бронирование</p>
        </div>
        {auth && session.status === 'ready' && session.user && (
          <div className="flex items-center gap-3">
            <span className="hidden max-w-48 truncate text-sm text-slate-600 sm:inline">{session.user.email}</span>
            <button
              type="button"
              onClick={() => void auth.signOut()}
              className="min-h-11 rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium hover:bg-slate-50"
            >
              Выйти
            </button>
          </div>
        )}
      </header>

      <main>
        {session.status === 'checking' && (
          <p role="status" className="text-center text-slate-600">
            Проверяем вход…
          </p>
        )}
        {session.status === 'ready' && auth && !session.user && <AuthForm auth={auth} />}
        {session.status === 'ready' && (!auth || session.user) && (
          // key: при смене пользователя состояние каталога пересоздаётся
          <ToursPage key={session.user?.id ?? 'anonymous'} api={tours} />
        )}
      </main>
    </div>
  );
}
