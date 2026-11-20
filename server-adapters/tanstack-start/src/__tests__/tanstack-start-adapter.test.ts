import { Mastra } from '@mastra/core';
import { registerApiRoute } from '@mastra/core/server';
import { describe, it, expect } from 'vitest';
import { createStartRouteHandler } from '../index';
import type { StartRouteHandlers, StartHandlerContext } from '../index';

function createTestMastra(): Mastra {
  return new Mastra({});
}

function makeContext(method: string, path: string): StartHandlerContext {
  return {
    request: new Request(`http://localhost${path}`, { method }),
    params: {},
  };
}

describe('TanStack Start Adapter', () => {
  it('returns all HTTP method handlers', () => {
    const mastra = createTestMastra();
    const handlers: StartRouteHandlers = createStartRouteHandler({ mastra });

    expect(handlers.GET).toBeTypeOf('function');
    expect(handlers.POST).toBeTypeOf('function');
    expect(handlers.PUT).toBeTypeOf('function');
    expect(handlers.DELETE).toBeTypeOf('function');
    expect(handlers.PATCH).toBeTypeOf('function');
    expect(handlers.OPTIONS).toBeTypeOf('function');
    expect(handlers.HEAD).toBeTypeOf('function');
  });

  it('handlers return Response objects', async () => {
    const mastra = createTestMastra();
    const handlers = createStartRouteHandler({ mastra });

    const ctx = makeContext('GET', '/api');
    const response = await handlers.GET(ctx);

    expect(response).toBeInstanceOf(Response);
  });

  it('GET /api returns the OpenAPI spec or root response', async () => {
    const mastra = createTestMastra();
    const handlers = createStartRouteHandler({ mastra, prefix: '/api' });

    const ctx = makeContext('GET', '/api');
    const response = await handlers.GET(ctx);

    expect(response.status).toBeLessThan(500);
  });

  it('GET /api/agents returns a response', async () => {
    const mastra = createTestMastra();
    const handlers = createStartRouteHandler({ mastra, prefix: '/api' });

    const ctx = makeContext('GET', '/api/agents');
    const response = await handlers.GET(ctx);

    expect(response).toBeInstanceOf(Response);
    // Should return 200 with empty agents list or similar
    expect(response.status).toBeLessThan(500);
  });

  it('returns 404 for unknown routes', async () => {
    const mastra = createTestMastra();
    const handlers = createStartRouteHandler({ mastra, prefix: '/api' });

    const ctx = makeContext('GET', '/api/nonexistent-route-xyz');
    const response = await handlers.GET(ctx);

    expect(response).toBeInstanceOf(Response);
    expect(response.status).toBe(404);
  });

  it('accepts custom prefix', () => {
    const mastra = createTestMastra();
    const handlers = createStartRouteHandler({
      mastra,
      prefix: '/custom-api',
    });

    expect(handlers.GET).toBeTypeOf('function');
  });

  it('accepts custom tools', () => {
    const mastra = createTestMastra();
    const handlers = createStartRouteHandler({
      mastra,
      tools: {},
    });

    expect(handlers.GET).toBeTypeOf('function');
  });
});

describe('TanStack Start Adapter initialization', () => {
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

  it('retries initialization on the next request after a failed init', async () => {
    let attempt = 0;
    const { mastra, state } = createMastraWithHealthRoute(async () => {
      attempt++;
      if (attempt === 1) throw new Error('database not ready');
    });
    const handlers = createStartRouteHandler({ mastra });

    await expect(handlers.GET(makeContext('GET', '/health'))).rejects.toThrow('database not ready');

    const response = await handlers.GET(makeContext('GET', '/health'));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(state.calls).toBe(2);
  });

  it('shares a single in-flight initialization between concurrent requests', async () => {
    const { mastra, state } = createMastraWithHealthRoute(async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
    });
    const handlers = createStartRouteHandler({ mastra });

    const responses = await Promise.all([
      handlers.GET(makeContext('GET', '/health')),
      handlers.GET(makeContext('GET', '/health')),
    ]);

    expect(responses.map(r => r.status)).toEqual([200, 200]);
    expect(state.calls).toBe(1);
  });

  it('keeps a successful initialization cached', async () => {
    const { mastra, state } = createMastraWithHealthRoute(async () => {});
    const handlers = createStartRouteHandler({ mastra });

    expect((await handlers.GET(makeContext('GET', '/health'))).status).toBe(200);
    expect((await handlers.GET(makeContext('GET', '/health'))).status).toBe(200);
    expect(state.calls).toBe(1);
  });
});
