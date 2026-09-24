import { Mastra } from '@mastra/core';
import { Elysia } from 'elysia';
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
// Elysia re-serializes cookies from its jar, which normalizes attribute order.
const SERIALIZED_REFRESHED_COOKIE = 'session=valid; Path=/; HttpOnly';

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

describe('Elysia auth middleware helper', () => {
  it('protects raw Elysia routes outside Mastra route registration', async () => {
    const mastra = createMastraWithAuth();
    const app = new Elysia();
    const adapter = new MastraServer({ app, mastra });

    adapter.registerContextMiddleware();

    app.get(
      '/custom/protected',
      ({ requestContext }: any) => {
        const user = requestContext.get('mastra__user') as { id: string };
        return { userId: user.id };
      },
      { beforeHandle: createAuthMiddleware({ mastra }) },
    );

    const unauthenticated = await app.fetch(new Request('http://localhost/custom/protected'));
    expect(unauthenticated.status).toBe(401);

    const authenticated = await app.fetch(
      new Request('http://localhost/custom/protected', {
        headers: { Authorization: 'Bearer valid-token' },
      }),
    );
    expect(authenticated.status).toBe(200);
    await expect(authenticated.json()).resolves.toEqual({ userId: 'user-1' });
  });

  it('allows opting a raw Elysia route out with requiresAuth false', async () => {
    const mastra = createMastraWithAuth();
    const app = new Elysia();
    const adapter = new MastraServer({ app, mastra });

    adapter.registerContextMiddleware();

    app.get('/custom/public', () => ({ ok: true }), {
      beforeHandle: createAuthMiddleware({ mastra, requiresAuth: false }),
    });

    const response = await app.fetch(new Request('http://localhost/custom/public'));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it('forwards refreshed session headers after a transparent session refresh', async () => {
    const mastra = createMastraWithSessionRefresh();
    const app = new Elysia();
    const adapter = new MastraServer({ app, mastra });

    adapter.registerContextMiddleware();

    const middleware = createAuthMiddleware({ mastra });
    app.get('/custom/protected', () => ({ ok: true }), { beforeHandle: middleware });
    app.get('/custom/forbidden', () => ({ ok: true }), { beforeHandle: middleware });

    const allowed = await app.fetch(
      new Request('http://localhost/custom/protected', { headers: { Cookie: 'session=expired' } }),
    );
    expect(allowed.status).toBe(200);
    expect(allowed.headers.get('set-cookie')).toBe(SERIALIZED_REFRESHED_COOKIE);

    const denied = await app.fetch(
      new Request('http://localhost/custom/forbidden', { headers: { Cookie: 'session=expired' } }),
    );
    expect(denied.status).toBe(403);
    expect(denied.headers.get('set-cookie')).toBe(REFRESHED_COOKIE);
  });

  it('keeps cookies set by earlier hooks when forwarding refresh headers', async () => {
    const mastra = createMastraWithSessionRefresh();
    const app = new Elysia();
    const adapter = new MastraServer({ app, mastra });

    adapter.registerContextMiddleware();

    const middleware = createAuthMiddleware({ mastra });
    app.get('/custom/jar', () => ({ ok: true }), {
      beforeHandle: [
        (ctx: any) => {
          ctx.cookie.other.value = '1';
          ctx.cookie.other.path = '/';
        },
        middleware,
      ],
    });
    app.get('/custom/raw', () => ({ ok: true }), {
      beforeHandle: [
        (ctx: any) => {
          ctx.set.headers['set-cookie'] = 'raw=1; Path=/';
        },
        middleware,
      ],
    });
    app.get(
      '/custom/late',
      ({ cookie }: any) => {
        cookie.late.value = '1';
        return { ok: true };
      },
      { beforeHandle: middleware },
    );

    const request = (path: string) =>
      app.fetch(new Request(`http://localhost${path}`, { headers: { Cookie: 'session=expired' } }));

    const jar = await request('/custom/jar');
    expect(jar.status).toBe(200);
    expect(jar.headers.getSetCookie().sort()).toEqual(['other=1; Path=/', SERIALIZED_REFRESHED_COOKIE].sort());

    const raw = await request('/custom/raw');
    expect(raw.status).toBe(200);
    expect(raw.headers.getSetCookie().sort()).toEqual(['raw=1; Path=/', SERIALIZED_REFRESHED_COOKIE].sort());

    const late = await request('/custom/late');
    expect(late.status).toBe(200);
    expect(late.headers.getSetCookie()).toContain(SERIALIZED_REFRESHED_COOKIE);
  });
});
