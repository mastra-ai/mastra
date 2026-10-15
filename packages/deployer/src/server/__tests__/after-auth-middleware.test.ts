import { Mastra } from '@mastra/core/mastra';
import { registerApiRoute } from '@mastra/core/server';
import { describe, expect, it } from 'vitest';
import { createHonoServer } from '../index';

describe('afterAuth middleware under the deployer', () => {
  it('runs setServerMiddleware afterAuth entries once, after auth', async () => {
    const seen: Array<string | undefined> = [];
    const mastra = new Mastra({
      server: {
        apiRoutes: [registerApiRoute('/phase', { method: 'GET', handler: c => c.json({ ok: true }) })],
      },
    });
    mastra.setServerMiddleware([
      {
        path: '/phase',
        phase: 'afterAuth',
        handler: async (c, next) => {
          seen.push((c.get('requestContext').get('user') as { id?: string } | undefined)?.id);
          await next();
        },
      },
    ]);
    const server = mastra.getServer();
    mastra.setServer({ ...server, auth: { authenticateToken: async () => ({ id: 'user-1' }) } } as never);
    const app = await createHonoServer(mastra, { tools: {} });

    const res = await app.request('/phase', { headers: { Authorization: 'Bearer valid' } });

    expect(res.status).toBe(200);
    expect(seen).toEqual(['user-1']);
  });
});
