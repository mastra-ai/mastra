import { Mastra } from '@mastra/core';
import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';

import { createAuthMiddleware, MastraServer } from '../index';

function createMastraWithAuth() {
  const mastra = new Mastra({ logger: false });
  const originalGetServer = mastra.getServer.bind(mastra);

  mastra.getServer = () =>
    ({
      ...originalGetServer(),
      auth: {
        authenticateToken: async (token: string) =>
          token === 'valid-token' ? { id: 'user-1', email: 'user@example.com' } : null,
        authorize: async () => true,
      },
    }) as any;

  return mastra;
}

const REFRESHED_COOKIE = 'session=valid; HttpOnly; Path=/';

function createMastraWithSessionRefresh() {
  const mastra = new Mastra({ logger: false });
  const originalGetServer = mastra.getServer.bind(mastra);

  mastra.getServer = () =>
    ({
      ...originalGetServer(),
      auth: {
        authenticateToken: async (_token: string, request: any) =>
          request.headers.get('cookie')?.includes('session=valid') ? { id: 'user-1' } : null,
        authorize: async (path: string) => path !== '/custom/forbidden',
        getSessionIdFromRequest: (request: Request) =>
          request.headers.get('cookie')?.includes('session=expired') ? 'session-1' : null,
        refreshSession: async () => ({ id: 'session-1' }),
        getSessionHeaders: () => ({ 'Set-Cookie': REFRESHED_COOKIE }),
      },
    }) as any;

  return mastra;
}

describe('Hono auth middleware helper', () => {
  it('protects raw Hono routes outside Mastra route registration', async () => {
    const mastra = createMastraWithAuth();
    const app = new Hono();
    const adapter = new MastraServer({ app, mastra });

    adapter.registerContextMiddleware();

    app.get('/custom/protected', createAuthMiddleware({ mastra }), c => {
      const user = c.get('requestContext').get('mastra__user') as { id: string };
      return c.json({ userId: user.id });
    });

    const unauthenticated = await app.request('http://localhost/custom/protected');
    expect(unauthenticated.status).toBe(401);

    const authenticated = await app.request('http://localhost/custom/protected', {
      headers: { Authorization: 'Bearer valid-token' },
    });
    expect(authenticated.status).toBe(200);
    await expect(authenticated.json()).resolves.toEqual({ userId: 'user-1' });
  });

  it('allows opting a raw Hono route out with requiresAuth false', async () => {
    const mastra = createMastraWithAuth();
    const app = new Hono();
    const adapter = new MastraServer({ app, mastra });

    adapter.registerContextMiddleware();

    app.get('/custom/public', createAuthMiddleware({ mastra, requiresAuth: false }), c => c.json({ ok: true }));

    const response = await app.request('http://localhost/custom/public');
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it('forwards refreshed session headers after a transparent session refresh', async () => {
    const mastra = createMastraWithSessionRefresh();
    const app = new Hono();
    const adapter = new MastraServer({ app, mastra });

    adapter.registerContextMiddleware();

    const middleware = createAuthMiddleware({ mastra });
    app.get('/custom/protected', middleware, c => c.json({ ok: true }));
    app.get('/custom/forbidden', middleware, c => c.json({ ok: true }));

    const allowed = await app.request('http://localhost/custom/protected', {
      headers: { Cookie: 'session=expired' },
    });
    expect(allowed.status).toBe(200);
    expect(allowed.headers.get('set-cookie')).toBe(REFRESHED_COOKIE);

    const denied = await app.request('http://localhost/custom/forbidden', {
      headers: { Cookie: 'session=expired' },
    });
    expect(denied.status).toBe(403);
    expect(denied.headers.get('set-cookie')).toBe(REFRESHED_COOKIE);
  });

  it('keeps Set-Cookie headers set by earlier middleware when forwarding refresh headers', async () => {
    const mastra = createMastraWithSessionRefresh();
    const app = new Hono();
    const adapter = new MastraServer({ app, mastra });

    adapter.registerContextMiddleware();

    app.use('/custom/*', async (c, next) => {
      c.header('Set-Cookie', 'other=1; Path=/', { append: true });
      await next();
    });
    app.get('/custom/protected', createAuthMiddleware({ mastra }), c => c.json({ ok: true }));

    const res = await app.request('http://localhost/custom/protected', {
      headers: { Cookie: 'session=expired' },
    });
    expect(res.status).toBe(200);
    expect(res.headers.getSetCookie()).toEqual(['other=1; Path=/', REFRESHED_COOKIE]);
  });
});
