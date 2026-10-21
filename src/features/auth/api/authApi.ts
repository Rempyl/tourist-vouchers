// path: src/features/auth/api/authApi.ts
import type { SupabaseClient } from '@supabase/supabase-js';
import { ApiError, kindFromStatus } from '../../../shared/api/apiError';
import { log } from '../../../shared/api/logger';

export interface AuthUser {
  id: string;
  email: string;
}

export interface SignUpResult {
  /** true — Supabase отправил письмо, вход возможен только после подтверждения почты. */
  needsConfirmation: boolean;
}

export interface AuthApi {
  getUser(): Promise<AuthUser | null>;
  signIn(email: string, password: string): Promise<AuthUser>;
  signUp(email: string, password: string): Promise<SignUpResult>;
  signOut(): Promise<void>;
  /** Подписка на вход/выход; возвращает функцию отписки. */
  onChange(callback: (user: AuthUser | null) => void): () => void;
}

interface SupabaseUserLike {
  id: string;
  email?: string;
}

function toAuthUser(user: SupabaseUserLike): AuthUser {
  return { id: user.id, email: user.email ?? '' };
}

function authFailure(context: string, failure: { message: string; status?: number }): ApiError {
  const status = failure.status ?? null;
  // Для входа 400 означает неверную пару почта/пароль — показываем как «не авторизован»
  const kind = status === 400 ? 'unauthorized' : kindFromStatus(status);
  log('error', context, kind, { status, detail: failure.message });
  return new ApiError(kind, status, { cause: failure });
}

export function createSupabaseAuthApi(client: SupabaseClient): AuthApi {
  return {
    async getUser() {
      const { data, error } = await client.auth.getSession();
      if (error) throw authFailure('auth.getUser', error);
      return data.session ? toAuthUser(data.session.user) : null;
    },
    async signIn(email, password) {
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw authFailure('auth.signIn', error);
      return toAuthUser(data.user);
    },
    async signUp(email, password) {
      const { data, error } = await client.auth.signUp({ email, password });
      if (error) throw authFailure('auth.signUp', error);
      return { needsConfirmation: data.session === null };
    },
    async signOut() {
      const { error } = await client.auth.signOut();
      if (error) throw authFailure('auth.signOut', error);
    },
    onChange(callback) {
      const { data } = client.auth.onAuthStateChange((_event, session) => {
        callback(session ? toAuthUser(session.user) : null);
      });
      return () => data.subscription.unsubscribe();
    },
  };
}
