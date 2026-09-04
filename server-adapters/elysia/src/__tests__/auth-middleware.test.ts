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
});
