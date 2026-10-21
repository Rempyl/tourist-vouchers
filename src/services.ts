// path: src/services.ts
import { createSupabaseAuthApi } from './features/auth/api/authApi';
import { createMockToursApi } from './features/tours/api/mockToursApi';
import { createSupabaseToursApi } from './features/tours/api/supabaseToursApi';
import type { AppServices } from './App';
import { ApiError } from './shared/api/apiError';
import { supabase } from './shared/api/supabaseClient';

/** Supabase, если заданы VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY, иначе mock-данные. */
export function createServices(): AppServices {
  if (supabase) {
    return { tours: createSupabaseToursApi(supabase), auth: createSupabaseAuthApi(supabase) };
  }
  // Демонстрация состояния ошибки: http://localhost:5173/?mock=network-error
  const failMode = new URLSearchParams(window.location.search).get('mock');
  const failWith = failMode === 'network-error' ? new ApiError('network') : null;
  return { tours: createMockToursApi({ failWith }) };
}
