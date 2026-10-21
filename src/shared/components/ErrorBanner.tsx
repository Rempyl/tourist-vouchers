// path: src/shared/components/ErrorBanner.tsx
import type { ApiError } from '../api/apiError';

interface ErrorBannerProps {
  error: ApiError;
  onRetry?: () => void;
  onDismiss?: () => void;
}

export function ErrorBanner({ error, onRetry, onDismiss }: ErrorBannerProps) {
  return (
    <div
      role="alert"
      className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-900 sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="text-sm leading-snug">{error.message}</p>
      <div className="flex gap-2">
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="min-h-11 rounded-lg bg-red-700 px-4 text-sm font-medium text-white hover:bg-red-800"
          >
            Повторить
          </button>
        )}
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="min-h-11 rounded-lg border border-red-300 px-4 text-sm font-medium hover:bg-red-100"
          >
            Закрыть
          </button>
        )}
      </div>
    </div>
  );
}
