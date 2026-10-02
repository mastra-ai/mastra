import { describe, expect, it } from 'vitest';

import { DomainError, toStorageError } from '../../src/domain/errors.js';

describe('redacted errors', () => {
  it('exposes stable public fields without internal details', () => {
    const publicError = toStorageError({
      code: 'SQLITE_BUSY',
      message: 'SELECT token FROM secret payload=user@example.com',
    }).toPublic();
    expect(publicError).toEqual({
      code: 'STORAGE_UNAVAILABLE',
      message: 'Storage is temporarily unavailable.',
      retryable: true,
    });
    expect(JSON.stringify(publicError)).not.toContain('SELECT');
    expect(JSON.stringify(publicError)).not.toContain('example.com');
  });

  it('preserves domain conflicts', () => {
    expect(toStorageError(new DomainError('CONFLICT')).code).toBe('CONFLICT');
    expect(
      toStorageError({
        code: 'SQLITE_CONSTRAINT',
        cause: { code: 'SQLITE_CONSTRAINT_UNIQUE' },
      }).code,
    ).toBe('CONFLICT');
  });
});
