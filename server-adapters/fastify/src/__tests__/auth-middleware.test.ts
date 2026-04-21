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
      const user = request.requestContext.get('user') as { id: string };
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
});
