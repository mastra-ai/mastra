import type { Server } from 'node:http';

import { Mastra } from '@mastra/core';
import Koa from 'koa';
import { afterEach, describe, expect, it } from 'vitest';

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

async function listen(app: Koa): Promise<Server> {
  return new Promise(resolve => {
    const server = app.listen(0, () => resolve(server));
  });
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

describe('Koa auth middleware helper', () => {
  let server: Server | null = null;

  afterEach(async () => {
    if (!server) return;
    await new Promise<void>(resolve => server!.close(() => resolve()));
    server = null;
  });

  it('protects raw Koa routes outside Mastra route registration', async () => {
    const mastra = createMastraWithAuth();
    const app = new Koa();
    const adapter = new MastraServer({ app, mastra });

    app.use(adapter.createContextMiddleware());
    app.use(createAuthMiddleware({ mastra }));
    app.use(async ctx => {
      if (ctx.path === '/custom/protected') {
        const user = ctx.state.requestContext.get('mastra__user') as { id: string };
        ctx.body = { userId: user.id };
        return;
      }
      ctx.status = 404;
    });

    server = await listen(app);
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Failed to get server address');
    const baseUrl = `http://127.0.0.1:${address.port}`;

    const unauthenticated = await fetch(`${baseUrl}/custom/protected`);
    expect(unauthenticated.status).toBe(401);

    const authenticated = await fetch(`${baseUrl}/custom/protected`, {
      headers: { Authorization: 'Bearer valid-token' },
    });
    expect(authenticated.status).toBe(200);
    await expect(authenticated.json()).resolves.toEqual({ userId: 'user-1' });
  });

  it('allows opting a raw Koa route out with requiresAuth false', async () => {
    const mastra = createMastraWithAuth();
    const app = new Koa();
    const adapter = new MastraServer({ app, mastra });

    app.use(adapter.createContextMiddleware());
    app.use(createAuthMiddleware({ mastra, requiresAuth: false }));
    app.use(async ctx => {
      if (ctx.path === '/custom/public') {
        ctx.body = { ok: true };
        return;
      }
      ctx.status = 404;
    });

    server = await listen(app);
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Failed to get server address');

    const response = await fetch(`http://127.0.0.1:${address.port}/custom/public`);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it('forwards refreshed session headers after a transparent session refresh', async () => {
    const mastra = createMastraWithSessionRefresh();
    const app = new Koa();
    const adapter = new MastraServer({ app, mastra });

    app.use(adapter.createContextMiddleware());
    app.use(createAuthMiddleware({ mastra }));
    app.use(async ctx => {
      ctx.body = { ok: true };
    });

    server = await listen(app);
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Failed to get server address');
    const baseUrl = `http://127.0.0.1:${address.port}`;

    const allowed = await fetch(`${baseUrl}/custom/protected`, { headers: { Cookie: 'session=expired' } });
    expect(allowed.status).toBe(200);
    expect(allowed.headers.get('set-cookie')).toBe(REFRESHED_COOKIE);

    const denied = await fetch(`${baseUrl}/custom/forbidden`, { headers: { Cookie: 'session=expired' } });
    expect(denied.status).toBe(403);
    expect(denied.headers.get('set-cookie')).toBe(REFRESHED_COOKIE);
  });

  it('keeps cookies set by earlier middleware when forwarding refresh headers', async () => {
    const mastra = createMastraWithSessionRefresh();
    const app = new Koa();
    const adapter = new MastraServer({ app, mastra });

    app.use(adapter.createContextMiddleware());
    app.use(async (ctx, next) => {
      ctx.cookies.set('other', '1', { httpOnly: false });
      await next();
    });
    app.use(createAuthMiddleware({ mastra }));
    app.use(async ctx => {
      ctx.body = { ok: true };
    });

    server = await listen(app);
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Failed to get server address');

    const res = await fetch(`http://127.0.0.1:${address.port}/custom/protected`, {
      headers: { Cookie: 'session=expired' },
    });
    expect(res.status).toBe(200);
    expect(res.headers.getSetCookie()).toEqual(['other=1; path=/', REFRESHED_COOKIE]);
  });
});
