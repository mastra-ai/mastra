import { describe, expect, it } from 'vitest';

import { readStorageConfig, resolveStorageUrl } from '../../src/db/config.js';

describe('storage configuration', () => {
  it('normalizes relative file URLs and preserves remote/absolute URLs', () => {
    expect(resolveStorageUrl('file:./db.sqlite', '/tmp/project')).toBe('file:///tmp/project/db.sqlite');
    expect(resolveStorageUrl('file:/tmp/db.sqlite', '/ignored')).toBe('file:/tmp/db.sqlite');
    expect(resolveStorageUrl('libsql://example.turso.io', '/ignored')).toBe('libsql://example.turso.io');
  });

  it('preserves in-memory storage and rejects invalid URLs without exposing credentials', () => {
    expect(resolveStorageUrl('file::memory:')).toBe('file::memory:');
    expect(readStorageConfig({ MASTRA_STORAGE_URL: 'file::memory:' }).url).toBe('file::memory:');
    for (const value of ['invalid', 'postgres://database', 'https://user:private-password@example.test']) {
      try {
        readStorageConfig({ MASTRA_STORAGE_URL: value });
        expect.fail('Expected invalid storage configuration');
      } catch (error) {
        expect(String(error)).toContain('MASTRA_STORAGE_URL');
        expect(String(error)).not.toContain('private-password');
      }
    }
  });

  it('returns the same immutable URL/token contract for both consumers', () => {
    const config = readStorageConfig(
      {
        MASTRA_STORAGE_URL: 'libsql://example.turso.io',
        MASTRA_STORAGE_AUTH_TOKEN: 'test-token',
      },
      '/tmp/project',
    );
    expect(config).toEqual({
      url: 'libsql://example.turso.io',
      authToken: 'test-token',
    });
    expect(Object.isFrozen(config)).toBe(true);
  });
});
