// path: src/shared/api/apiError.test.ts
import { describe, expect, it } from 'vitest';
import { ApiError, kindFromStatus, toApiError } from './apiError';

describe('kindFromStatus', () => {
  it.each([
    [0, 'network'],
    [null, 'network'],
    [401, 'unauthorized'],
    [403, 'forbidden'],
    [404, 'not-found'],
    [400, 'validation'],
    [409, 'validation'],
    [500, 'server'],
    [503, 'server'],
  ] as const)('статус %s → %s', (status, kind) => {
    expect(kindFromStatus(status)).toBe(kind);
  });
});

describe('toApiError', () => {
  it('оставляет ApiError как есть', () => {
    const original = new ApiError('forbidden', 403);
    expect(toApiError(original)).toBe(original);
  });
  it('неизвестную ошибку превращает в сетевую с исходной причиной', () => {
    const cause = new TypeError('Failed to fetch');
    const result = toApiError(cause);
    expect(result.kind).toBe('network');
    expect(result.cause).toBe(cause);
  });
});
