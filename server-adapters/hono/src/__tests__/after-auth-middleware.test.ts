import { Mastra } from '@mastra/core';
import type { Middleware } from '@mastra/core/server';
import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';

import { MastraServer } from '../index';

function createApp(middleware: Middleware[]) {
  const mastra = new Mastra({
    logger: false,
    server: {
      middleware,
      apiRoutes: [
        {
          method: 'GET',
          path: '/private',
          handler: c => c.json({ seen: c.get('requestContext').get('seen') ?? null }),
        },
        {
          method: 'GET',
          path: '/public',
          requiresAuth: false,
          handler: c => c.json({ seen: c.get('requestContext').get('seen') ?? null }),
        },
      ],
    },
  });
  const originalGetServer = mastra.getServer.bind(mastra);
  mastra.getServer = () =>
    ({
      ...originalGetServer(),
      auth: {
        authenticateToken: async (token: string) => (token === 'valid' ? { id: 'user-1', name: 'Ada' } : null),
      },
    }) as any;
  return mastra;
}

async function init(middleware: Middleware[]) {
  const app = new Hono();
  await new MastraServer({ app, mastra: createApp(middleware) }).init();
  return app;
}

const authed = { headers: { Authorization: 'Bearer valid' } };

describe("server.middleware phase: 'afterAuth'", () => {
  it('runs after auth with the authenticated user on requestContext', async () => {
    const app = await init([
      {
        path: '*',
        phase: 'afterAuth',
        handler: async (c, next) => {
          const user = c.get('requestContext').get('user') as { name: string } | undefined;
          c.get('requestContext').set('seen', user?.name ?? 'no-user');
          await next();
        },
      },
    ]);

    const response = await app.request('http://localhost/private', authed);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ seen: 'Ada' });
  });

  it('does not run when auth fails', async () => {
    let ran = false;
    const app = await init([
      {
        path: '*',
        phase: 'afterAuth',
        handler: async (_c, next) => {
          ran = true;
          await next();
        },
      },
    ]);

    const response = await app.request('http://localhost/private');
    expect(response.status).toBe(401);
    expect(ran).toBe(false);
  });

  it('can short-circuit the route with its own response', async () => {
    const app = await init([
      {
        path: '*',
        phase: 'afterAuth',
        handler: async c => c.json({ error: 'organization_forbidden' }, 403),
      },
    ]);

    const response = await app.request('http://localhost/private', authed);
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: 'organization_forbidden' });
  });

  it('skips routes declared public and honors the path scope', async () => {
    const calls: string[] = [];
    const app = await init([
      {
        path: '/other/*',
        phase: 'afterAuth',
        handler: async (_c, next) => {
          calls.push('scoped');
          await next();
        },
      },
      {
        path: '*',
        phase: 'afterAuth',
        handler: async (c, next) => {
          calls.push(c.req.path);
          await next();
        },
      },
    ]);

    await app.request('http://localhost/public');
    await app.request('http://localhost/private', authed);
    expect(calls).toEqual(['/private']);
  });

  it('runs on built-in routes', async () => {
    const calls: string[] = [];
    const app = await init([
      {
        path: '/api/*',
        phase: 'afterAuth',
        handler: async (c, next) => {
          calls.push(c.req.path);
          await next();
        },
      },
    ]);

    const response = await app.request('http://localhost/api/agents', authed);
    expect(response.status).toBe(200);
    expect(calls).toEqual(['/api/agents']);
  });

  it('keeps refreshed session headers on custom route responses', async () => {
    const mastra = new Mastra({
      logger: false,
      server: {
        apiRoutes: [{ method: 'GET', path: '/private', handler: c => c.json({ ok: true }) }],
      },
    });
    const originalGetServer = mastra.getServer.bind(mastra);
    mastra.getServer = () =>
      ({
        ...originalGetServer(),
        auth: {
          authenticateToken: async (_token: string, request: Request) =>
            request.headers.get('cookie')?.includes('session=valid') ? { id: 'user-1' } : null,
          getSessionIdFromRequest: (request: Request) =>
            request.headers.get('cookie')?.includes('session=expired') ? 'session-1' : null,
          refreshSession: async () => ({ id: 'session-1' }),
          getSessionHeaders: () => ({ 'Set-Cookie': 'session=valid; HttpOnly; Path=/' }),
        },
      }) as any;
    const app = new Hono();
    await new MastraServer({ app, mastra }).init();

    const response = await app.request('http://localhost/private', { headers: { Cookie: 'session=expired' } });
    expect(response.status).toBe(200);
    expect(response.headers.getSetCookie()).toEqual(['session=valid; HttpOnly; Path=/']);
  });

  it('is not also registered as global beforeAuth middleware', async () => {
    let ran = 0;
    const app = await init([
      {
        path: '*',
        phase: 'afterAuth',
        handler: async (_c, next) => {
          ran++;
          await next();
        },
      },
    ]);

    await app.request('http://localhost/private', authed);
    expect(ran).toBe(1);
  });
});
