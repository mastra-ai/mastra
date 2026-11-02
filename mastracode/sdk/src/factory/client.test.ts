import { describe, expect, it, vi } from 'vitest';

import { refreshingFetch } from './client';

const authOf = (init?: RequestInit) => new Headers(init?.headers).get('Authorization');

describe('refreshingFetch', () => {
  it('refreshes an expired Platform token and replays the request once', async () => {
    const address = { url: 'https://factory.test', session: { token: 'old', orgId: 'o' } };
    const base = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) =>
      authOf(init) === 'Bearer new' ? new Response('ok') : new Response('{}', { status: 401 }),
    );
    const refresh = vi.fn(async () => ({ token: 'new', orgId: 'o' }));

    const res = await refreshingFetch(address, refresh, base)('https://factory.test/x', { method: 'POST', body: 'b' });

    expect(res.status).toBe(200);
    expect(base.mock.calls.map(([, init]) => authOf(init))).toEqual(['Bearer old', 'Bearer new']);
    expect(base.mock.calls[1]![1]).toMatchObject({ method: 'POST', body: 'b' });
    expect(address.session.token).toBe('new');
  });

  it('shares one refresh across concurrent 401s', async () => {
    const address = { url: 'https://factory.test', session: { token: 'old', orgId: 'o' } };
    const base = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) =>
      authOf(init) === 'Bearer new' ? new Response('ok') : new Response('{}', { status: 401 }),
    );
    const refresh = vi.fn(async () => ({ token: 'new', orgId: 'o' }));
    const fetcher = refreshingFetch(address, refresh, base);

    const results = await Promise.all([fetcher('https://factory.test/a'), fetcher('https://factory.test/b')]);

    expect(results.map(res => res.status)).toEqual([200, 200]);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('retries with a token another request already refreshed', async () => {
    const address = { url: 'https://factory.test', session: { token: 'old', orgId: 'o' } };
    const base = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (authOf(init) === 'Bearer new') return new Response('ok');
      address.session = { token: 'new', orgId: 'o' };
      return new Response('{}', { status: 401 });
    });
    const refresh = vi.fn(async () => null);

    const res = await refreshingFetch(address, refresh, base)('https://factory.test/x');

    expect(res.status).toBe(200);
    expect(refresh).not.toHaveBeenCalled();
  });

  it('returns the 401 when the token cannot be refreshed', async () => {
    const address = { url: 'https://factory.test', session: { token: 'old', orgId: 'o' } };
    const base = vi.fn(async () => new Response('{}', { status: 401 }));

    const res = await refreshingFetch(address, async () => null, base)('https://factory.test/x');

    expect(res.status).toBe(401);
    expect(base).toHaveBeenCalledTimes(1);
  });
});
