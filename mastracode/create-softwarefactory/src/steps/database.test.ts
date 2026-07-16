import { describe, expect, it } from 'vitest';

import { isPostgresUrl } from './database.js';

describe('isPostgresUrl', () => {
  it('accepts postgres:// and postgresql:// URLs', () => {
    expect(isPostgresUrl('postgres://user:pass@localhost:54329/mastracode_web')).toBe(true);
    expect(isPostgresUrl('postgresql://u@h/db')).toBe(true);
  });

  it('rejects other schemes and garbage', () => {
    expect(isPostgresUrl('mysql://u@h/db')).toBe(false);
    expect(isPostgresUrl('http://example.com')).toBe(false);
    expect(isPostgresUrl('not a url')).toBe(false);
    expect(isPostgresUrl('')).toBe(false);
  });
});
