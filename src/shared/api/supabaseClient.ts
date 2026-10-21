// path: src/shared/api/supabaseClient.ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url: unknown = import.meta.env.VITE_SUPABASE_URL;
const anonKey: unknown = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * Единственный Supabase-клиент приложения. В браузере используется только публичный anon-ключ.
 * Если переменные окружения не заданы, клиента нет и приложение работает на mock-данных.
 */
export const supabase: SupabaseClient | null =
  typeof url === 'string' && url !== '' && typeof anonKey === 'string' && anonKey !== ''
    ? createClient(url, anonKey)
    : null;
