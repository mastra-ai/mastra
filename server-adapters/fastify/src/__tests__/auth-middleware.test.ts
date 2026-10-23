import { Mastra } from '@mastra/core';
import fastify from 'fastify';
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

describe('Fastify auth middleware helper', () => {
  let app: ReturnType<typeof fastify> | null = null;

  afterEach(async () => {
    if (!app) return;
    await app.close();
    app = null;
  });

  it('protects raw Fastify routes outside Mastra route registration', async () => {
    const mastra = createMastraWithAuth();
    app = fastify();
    const adapter = new MastraServer({ app, mastra });

    adapter.registerContextMiddleware();

    app.get('/custom/protected', { preHandler: createAuthMiddleware({ mastra }) }, async request => {
      const user = request.requestContext.get('mastra__user') as { id: string };
      return { userId: user.id };
    });

    await app.listen({ port: 0, host: '127.0.0.1' });
    const address = app.server.address();
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

  it('allows opting a raw Fastify route out with requiresAuth false', async () => {
    const mastra = createMastraWithAuth();
    app = fastify();
    const adapter = new MastraServer({ app, mastra });

    adapter.registerContextMiddleware();

    app.get('/custom/public', { preHandler: createAuthMiddleware({ mastra, requiresAuth: false }) }, async () => {
      return { ok: true };
    });

    await app.listen({ port: 0, host: '127.0.0.1' });
    const address = app.server.address();
    if (!address || typeof address === 'string') throw new Error('Failed to get server address');

    const response = await fetch(`http://127.0.0.1:${address.port}/custom/public`);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it('forwards refreshed session headers after a transparent session refresh', async () => {
    const mastra = createMastraWithSessionRefresh();
    app = fastify();
    const adapter = new MastraServer({ app, mastra });

    adapter.registerContextMiddleware();

    const preHandler = createAuthMiddleware({ mastra });
    app.get('/custom/protected', { preHandler }, async () => ({ ok: true }));
    app.get('/custom/forbidden', { preHandler }, async () => ({ ok: true }));

    await app.listen({ port: 0, host: '127.0.0.1' });
    const address = app.server.address();
    if (!address || typeof address === 'string') throw new Error('Failed to get server address');
    const baseUrl = `http://127.0.0.1:${address.port}`;

    const allowed = await fetch(`${baseUrl}/custom/protected`, { headers: { Cookie: 'session=expired' } });
    expect(allowed.status).toBe(200);
    expect(allowed.headers.get('set-cookie')).toBe(REFRESHED_COOKIE);

    const denied = await fetch(`${baseUrl}/custom/forbidden`, { headers: { Cookie: 'session=expired' } });
    expect(denied.status).toBe(403);
    expect(denied.headers.get('set-cookie')).toBe(REFRESHED_COOKIE);
  });
});
