import { Mastra } from '@mastra/core';
import { Elysia } from 'elysia';
import { describe, expect, it } from 'vitest';

import { applyAuthRefreshHeaders, createAuthMiddleware, MastraServer } from '../index';

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

  describe('session refresh', () => {
    const REFRESHED_COOKIE = 'session=valid; HttpOnly; Path=/';
    const expiredRequest = (path: string) =>
      new Request(`http://localhost${path}`, { headers: { cookie: 'session=expired' } });

    function createApp() {
      const mastra = createMastraWithSessionRefresh();
      const app = new Elysia();
      const adapter = new MastraServer({ app, mastra });
      adapter.registerContextMiddleware();
      return { app, auth: createAuthMiddleware({ mastra }) };
    }

    function createMastraWithSessionRefresh() {
      const mastra = new Mastra({ logger: false });
      const originalGetServer = mastra.getServer.bind(mastra);

      mastra.getServer = () =>
        ({
          ...originalGetServer(),
          auth: {
            authenticateToken: async (_token: string, request: Request) =>
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

    it('forwards refreshed session headers on allowed responses', async () => {
      const { app, auth } = createApp();
      app.get('/custom/protected', () => ({ ok: true }), { beforeHandle: auth });

      const response = await app.fetch(expiredRequest('/custom/protected'));

      expect(response.status).toBe(200);
      expect(response.headers.getSetCookie()).toEqual([REFRESHED_COOKIE]);
      await expect(response.json()).resolves.toEqual({ ok: true });
    });

    it('forwards refreshed session headers on forbidden responses', async () => {
      const { app, auth } = createApp();
      app.get('/custom/forbidden', () => ({ ok: true }), { beforeHandle: auth });

      const response = await app.fetch(expiredRequest('/custom/forbidden'));

      expect(response.status).toBe(403);
      expect(response.headers.getSetCookie()).toEqual([REFRESHED_COOKIE]);
    });

    it('forwards refreshed session headers when the handler throws', async () => {
      const { app, auth } = createApp();
      app.get(
        '/custom/protected',
        ctx => {
          ctx.cookie.app.value = 'one';
          throw new Error('boom');
        },
        { beforeHandle: auth },
      );

      const response = await app.fetch(expiredRequest('/custom/protected'));

      expect(response.status).toBe(500);
      expect(response.headers.getSetCookie()).toEqual(['app=one; Path=/', REFRESHED_COOKIE]);
    });

    it('forwards refreshed session headers to responses from adapter error handling', async () => {
      const mastra = createMastraWithSessionRefresh();
      const app = new Elysia();
      const adapter = new MastraServer({ app, mastra });
      adapter.registerContextMiddleware();
      adapter.registerAuthMiddleware();
      app.get(
        '/custom/protected',
        () => {
          throw new Error('boom');
        },
        { beforeHandle: createAuthMiddleware({ mastra }) },
      );

      const response = await app.fetch(expiredRequest('/custom/protected'));

      expect(response.status).toBe(500);
      expect(response.headers.get('content-type')).toBe('application/json');
      expect(response.headers.getSetCookie()).toEqual([REFRESHED_COOKIE]);
    });

    it('forwards refreshed session headers when the hooks are registered without MastraServer', async () => {
      const mastra = createMastraWithSessionRefresh();
      const app = new Elysia()
        .onAfterHandle({ as: 'global' }, applyAuthRefreshHeaders)
        .onError({ as: 'global' }, applyAuthRefreshHeaders);
      app.get('/custom/protected', () => ({ ok: true }), { beforeHandle: createAuthMiddleware({ mastra }) });

      const response = await app.fetch(expiredRequest('/custom/protected'));

      expect(response.status).toBe(200);
      expect(response.headers.getSetCookie()).toEqual([REFRESHED_COOKIE]);
    });

    it('forwards refreshed session headers when called inside the handler', async () => {
      const { app, auth } = createApp();
      app.get('/custom/protected', async ctx => {
        const authResponse = await auth(ctx);
        if (authResponse) return authResponse;
        return { ok: true };
      });

      const response = await app.fetch(expiredRequest('/custom/protected'));

      expect(response.status).toBe(200);
      expect(response.headers.getSetCookie()).toEqual([REFRESHED_COOKIE]);
    });

    it('does not add headers when no refresh happened', async () => {
      const { app, auth } = createApp();
      app.get('/custom/protected', () => ({ ok: true }), { beforeHandle: auth });

      const response = await app.fetch(
        new Request('http://localhost/custom/protected', { headers: { cookie: 'session=valid' } }),
      );

      expect(response.status).toBe(200);
      expect(response.headers.getSetCookie()).toEqual([]);
    });

    it('keeps a cookie set through ctx.cookie in an earlier hook', async () => {
      const { app, auth } = createApp();
      app.get('/custom/protected', () => ({ ok: true }), {
        beforeHandle: [
          ({ cookie }: any) => {
            cookie.app.value = 'one';
          },
          auth,
        ],
      });

      const response = await app.fetch(expiredRequest('/custom/protected'));

      expect(response.status).toBe(200);
      expect(response.headers.getSetCookie()).toEqual(['app=one; Path=/', REFRESHED_COOKIE]);
    });

    it('keeps a raw set-cookie header set by the handler', async () => {
      const { app, auth } = createApp();
      app.get(
        '/custom/protected',
        ({ set }: any) => {
          set.headers['set-cookie'] = 'raw=one';
          return { ok: true };
        },
        { beforeHandle: auth },
      );

      const response = await app.fetch(expiredRequest('/custom/protected'));

      expect(response.status).toBe(200);
      expect(response.headers.getSetCookie()).toEqual(['raw=one', REFRESHED_COOKIE]);
    });

    it('keeps a cookie set through ctx.cookie in the handler', async () => {
      const { app, auth } = createApp();
      app.get(
        '/custom/protected',
        ({ cookie }: any) => {
          cookie.handler.value = 'one';
          return 'ok';
        },
        { beforeHandle: auth },
      );

      const response = await app.fetch(expiredRequest('/custom/protected'));

      expect(response.status).toBe(200);
      expect(response.headers.getSetCookie()).toEqual(['handler=one; Path=/', REFRESHED_COOKIE]);
      await expect(response.text()).resolves.toBe('ok');
    });

    it('keeps a cookie on a Response returned by the handler', async () => {
      const { app, auth } = createApp();
      app.get(
        '/custom/protected',
        () =>
          new Response('ok', {
            status: 201,
            headers: { 'set-cookie': 'response=one', 'x-custom': 'yes' },
          }),
        { beforeHandle: auth },
      );

      const response = await app.fetch(expiredRequest('/custom/protected'));

      expect(response.status).toBe(201);
      expect(response.headers.get('x-custom')).toBe('yes');
      expect(response.headers.getSetCookie()).toEqual(['response=one', REFRESHED_COOKIE]);
      await expect(response.text()).resolves.toBe('ok');
    });

    it('keeps every app cookie when hooks, set headers, and a returned Response all set cookies', async () => {
      const { app, auth } = createApp();
      app.get(
        '/custom/protected',
        ({ set }: any) => {
          set.headers['set-cookie'] = 'raw=one';
          return new Response('ok', { headers: { 'set-cookie': 'response=one' } });
        },
        {
          beforeHandle: [
            ({ cookie }: any) => {
              cookie.hook.value = 'one';
            },
            auth,
          ],
        },
      );

      const response = await app.fetch(expiredRequest('/custom/protected'));

      expect(response.status).toBe(200);
      expect(response.headers.getSetCookie().sort()).toEqual(
        ['hook=one; Path=/', 'raw=one', 'response=one', REFRESHED_COOKIE].sort(),
      );
    });
  });
});
