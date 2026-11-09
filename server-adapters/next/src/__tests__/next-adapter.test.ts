import { Mastra } from '@mastra/core';
import { registerApiRoute } from '@mastra/core/server';
import { describe, it, expect } from 'vitest';
import { createNextRouteHandler } from '../index';

function createMastraWithHealthRoute(createHandlerImpl: () => Promise<void>) {
  const state = { calls: 0 };
  const mastra = new Mastra({
    logger: false,
    server: {
      apiRoutes: [
        registerApiRoute('/health', {
          method: 'GET',
          requiresAuth: false,
          createHandler: async () => {
            state.calls++;
            await createHandlerImpl();
            return c => c.json({ ok: true });
          },
        }),
      ],
    },
  });
  return { mastra, state };
}

const healthRequest = () => new Request('http://localhost/health');

describe('Next Adapter initialization', () => {
  it('retries initialization on the next request after a failed init', async () => {
    let attempt = 0;
    const { mastra, state } = createMastraWithHealthRoute(async () => {
      attempt++;
      if (attempt === 1) throw new Error('database not ready');
    });
    const { GET } = createNextRouteHandler({ mastra });

    await expect(GET(healthRequest())).rejects.toThrow('database not ready');

    const response = await GET(healthRequest());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(state.calls).toBe(2);
  });

  it('shares a single in-flight initialization between concurrent requests', async () => {
    const { mastra, state } = createMastraWithHealthRoute(async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
    });
    const { GET } = createNextRouteHandler({ mastra });

    const responses = await Promise.all([GET(healthRequest()), GET(healthRequest())]);

    expect(responses.map(r => r.status)).toEqual([200, 200]);
    expect(state.calls).toBe(1);
  });

  it('keeps a successful initialization cached', async () => {
    const { mastra, state } = createMastraWithHealthRoute(async () => {});
    const { GET } = createNextRouteHandler({ mastra });

    expect((await GET(healthRequest())).status).toBe(200);
    expect((await GET(healthRequest())).status).toBe(200);
    expect(state.calls).toBe(1);
  });
});
