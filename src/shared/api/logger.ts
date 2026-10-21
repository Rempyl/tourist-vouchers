// path: src/shared/api/logger.ts

type LogLevel = 'info' | 'warning' | 'error';

interface LogEntry {
  level: LogLevel;
  context: string;
  message: string;
  time: string;
  [key: string]: unknown;
}

/** Единственное место, где разрешён вывод в консоль: структурный JSON-лог. */
export function log(level: LogLevel, context: string, message: string, extra: Record<string, unknown> = {}): void {
  const entry: LogEntry = { level, context, message, time: new Date().toISOString(), ...extra };
  const line = JSON.stringify(entry);
  if (level === 'error') console.error(line);
  else if (level === 'warning') console.warn(line);
  else console.info(line);
}
