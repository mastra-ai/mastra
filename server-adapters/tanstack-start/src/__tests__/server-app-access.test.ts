import { Mastra } from '@mastra/core/mastra';
import { describe, expect, it } from 'vitest';
import { MastraServer } from '../index';

describe('MastraServer (TanStack Start) - Server App Access', () => {
  it('returns app passed to constructor', () => {
    const mastra = new Mastra({ logger: false });
    const adapter = new MastraServer({ mastra });

    const app = adapter.getApp();
    expect(app).toBe(adapter.app);
  });

  it('registers adapter with Mastra instance', () => {
    const mastra = new Mastra({ logger: false });
    const adapter = new MastraServer({ mastra });

    expect(mastra.getMastraServer()).toBeDefined();
    expect(mastra.getServerApp()).toBe(adapter.app);
  });

  it('supports forwarding requests through createRequestHandler', async () => {
    const mastra = new Mastra({ logger: false });
    const adapter = new MastraServer({ mastra });

    await adapter.init();
    const handler = adapter.createRequestHandler();
    const response = await handler({ request: new Request('http://localhost/api/agents') });

    expect(response.status).toBe(200);
  });
});
