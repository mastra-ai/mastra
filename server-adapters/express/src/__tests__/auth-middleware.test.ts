import type { Server } from 'node:http';

import { Mastra } from '@mastra/core';
import express from 'express';
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

async function listen(app: express.Application): Promise<Server> {
  return new Promise(resolve => {
    const server = app.listen(0, () => resolve(server));
  });
}

describe('Express auth middleware helper', () => {
  let server: Server | null = null;

  afterEach(async () => {
    if (!server) return;
    await new Promise<void>(resolve => server!.close(() => resolve()));
    server = null;
  });

  it('protects raw Express routes outside Mastra route registration', async () => {
    const mastra = createMastraWithAuth();
    const app = express();
    const adapter = new MastraServer({ app, mastra });

    app.use(express.json());
    adapter.registerContextMiddleware();

    app.get('/custom/protected', createAuthMiddleware({ mastra }), (req, res) => {
      const user = res.locals.requestContext.get('user') as { id: string };
      res.json({ userId: user.id });
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

  it('allows opting a raw Express route out with requiresAuth false', async () => {
    const mastra = createMastraWithAuth();
    const app = express();
    const adapter = new MastraServer({ app, mastra });

    app.use(express.json());
    adapter.registerContextMiddleware();

    app.get('/custom/public', createAuthMiddleware({ mastra, requiresAuth: false }), (_req, res) => {
      res.json({ ok: true });
    });

    server = await listen(app);
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Failed to get server address');

    const response = await fetch(`http://127.0.0.1:${address.port}/custom/public`);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });
});
