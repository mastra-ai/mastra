import { describe, expect, it } from 'vitest';
import { fetchJson } from '../utils.js';

describe('auth — capabilities + me in dev (auth disabled)', () => {
  it('GET /auth/capabilities reports enabled=false in the smoke fixture', async () => {
    const { status, data } = await fetchJson<any>('/api/auth/capabilities');
    expect(status).toBe(200);
    expect(data).toBeDefined();
    expect(data.enabled).toBe(false);
    // login is null when no auth provider is configured.
    expect(data.login).toBeNull();
  });

  it('GET /auth/me returns null when no user is signed in', async () => {
    const { status, data } = await fetchJson<any>('/api/auth/me');
    expect(status).toBe(200);
    expect(data).toBeNull();
  });
});
