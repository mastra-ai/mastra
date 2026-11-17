/**
 * Replay preview/import derive `datasets:write`, but they copy a whole thread transcript into a dataset.
 * Reading transcripts is gated by `memory:read` on the memory routes, so these routes require it too.
 */

import { ITEMS_FROM_THREAD_ROUTE, PREVIEW_REPLAY_ROUTE } from '@mastra/server/handlers/datasets';
import { Hono } from 'hono';
import { beforeEach, describe, expect, it } from 'vitest';
import { MastraServer } from '../index';
import { goldenThreadFixture } from './fixtures/golden-thread';

/** Bearer token = role id; the RBAC provider grants that role's permissions. */
const roles: Record<string, string[]> = {
  'dataset-writer': ['datasets:write'],
  'dataset-writer-with-memory': ['datasets:write', 'memory:read'],
};

async function setup() {
  const { mastra } = await goldenThreadFixture();
  const originalGetServer = mastra.getServer.bind(mastra);
  mastra.getServer = () => ({
    ...originalGetServer(),
    auth: {
      authenticateToken: async (token: string) => (roles[token] ? { id: `user_${token}`, role: token } : null),
      authorize: async () => true,
    },
    rbac: {
      getPermissions: async (user: { role: string }) => roles[user.role] ?? [],
      getRoles: async (user: { role: string }) => [user.role],
    },
  });
  const app = new Hono();
  const adapter = new MastraServer({ app, mastra });
  adapter.registerContextMiddleware();
  adapter.registerAuthMiddleware();
  for (const route of [PREVIEW_REPLAY_ROUTE, ITEMS_FROM_THREAD_ROUTE]) {
    await adapter.registerRoute(app, route, { prefix: '/api' });
  }
  const dataset = await mastra.datasets.create({ name: 'Replay', targetType: 'agent', targetIds: ['support'] });
  const source = { agentId: 'support', threadId: 'golden-thread', resourceId: 'support' };
  const request = (role: string, path: string) =>
    app.request(
      new Request(`http://localhost/api${path}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${role}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(source),
      }),
    );
  return {
    mastra,
    dataset,
    preview: (role: string) => request(role, '/datasets/replay/preview'),
    importThread: (role: string) => request(role, `/datasets/${dataset.id}/items/from-thread`),
  };
}

describe('replay routes under RBAC', () => {
  let routes: Awaited<ReturnType<typeof setup>>;

  beforeEach(async () => {
    routes = await setup();
  });

  describe('when the caller can write datasets but cannot read memory', () => {
    it('is refused previewing a thread', async () => {
      const response = await routes.preview('dataset-writer');

      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({ error: 'Missing required permission: memory:read' });
    });

    it('is refused importing a thread, and no items are created', async () => {
      const response = await routes.importThread('dataset-writer');

      expect(response.status).toBe(403);
      expect((await routes.dataset.listItems({ perPage: 10 })).items).toHaveLength(0);
    });
  });

  describe('when the caller can write datasets and read memory', () => {
    it('previews the thread', async () => {
      const response = await routes.preview('dataset-writer-with-memory');

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ turnCount: 10, historyLimit: 10 });
    });

    it('imports the thread', async () => {
      const response = await routes.importThread('dataset-writer-with-memory');

      expect(response.status).toBe(200);
      expect((await routes.dataset.listItems({ perPage: 100 })).items).toHaveLength(10);
    });
  });
});
