import { Mastra } from '@mastra/core';
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

describe('TanStack Start auth middleware helper', () => {
  it('protects raw routes outside Mastra route registration', async () => {
    const mastra = createMastraWithAuth();
    const adapter = new MastraServer({ mastra });
    const app = adapter.app;

    adapter.registerContextMiddleware();

    app.get('/custom/protected', createAuthMiddleware({ mastra }), c => {
      const user = c.get('requestContext').get('user') as { id: string };
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
});
