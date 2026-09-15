import { Mastra } from '@mastra/core';
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
