import { Mastra } from '@mastra/core';
import { registerApiRoute } from '@mastra/core/server';
import { MastraServer } from '@mastra/hono';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSvelteKitRouteHandler } from '../index';
import type { SvelteKitHandlerContext, SvelteKitRouteHandlers } from '../index';

function createTestMastra(config: ConstructorParameters<typeof Mastra>[0] = {}): Mastra {
  return new Mastra({ logger: false, ...config });
}

function makeEvent(path: string, init?: RequestInit): SvelteKitHandlerContext {
  return { request: new Request(`http://localhost${path}`, init) };
}

describe('SvelteKit adapter', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns a handler for every HTTP method', () => {
    const handlers: SvelteKitRouteHandlers = createSvelteKitRouteHandler({ mastra: createTestMastra() });

    for (const method of ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'] as const) {
      expect(handlers[method]).toBeTypeOf('function');
    }
  });

  it('serves Mastra routes under the default /api prefix', async () => {
    const { GET } = createSvelteKitRouteHandler({ mastra: createTestMastra() });

    const response = await GET(makeEvent('/api/agents'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({});
  });

  it('returns 404 for unknown routes', async () => {
    const { GET } = createSvelteKitRouteHandler({ mastra: createTestMastra() });

    const response = await GET(makeEvent('/api/nonexistent-route'));

    expect(response.status).toBe(404);
  });

  it('serves routes under a custom prefix only', async () => {
    const { GET } = createSvelteKitRouteHandler({ mastra: createTestMastra(), prefix: '/api/mastra' });

    expect((await GET(makeEvent('/api/mastra/agents'))).status).toBe(200);
    expect((await GET(makeEvent('/api/agents'))).status).toBe(404);
  });

  it('passes every HTTP method through to the Hono app', async () => {
    const mastra = createTestMastra({
      server: {
        apiRoutes: [
          registerApiRoute('/echo', {
            method: 'ALL',
            requiresAuth: false,
            handler: async c => c.json({ method: c.req.method }),
          }),
        ],
      },
    });
    const handlers = createSvelteKitRouteHandler({ mastra });

    for (const method of ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] as const) {
      const response = await handlers[method](makeEvent('/echo', { method }));

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({ method });
    }
  });

  it('answers HEAD requests without a body', async () => {
    const { HEAD } = createSvelteKitRouteHandler({ mastra: createTestMastra() });

    const response = await HEAD(makeEvent('/api/agents', { method: 'HEAD' }));

    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toBe('');
  });

  it('rejects request bodies over the configured server.bodySizeLimit', async () => {
    const { POST } = createSvelteKitRouteHandler({
      mastra: createTestMastra({ server: { bodySizeLimit: 16 } }),
    });
    const body = JSON.stringify({ messages: 'x'.repeat(64) });

    const response = await POST(
      makeEvent('/api/agents/any-agent/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'content-length': String(body.length) },
        body,
      }),
    );

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toEqual({ error: 'Request body too large' });
  });

  it('forwards custom API routes and their auth configuration', async () => {
    const mastra = createTestMastra({
      server: {
        auth: {
          authenticateToken: async (token: string) => (token === 'valid-token' ? { id: 'user-1' } : null),
          authorize: async () => true,
        } as never,
        apiRoutes: [
          registerApiRoute('/custom/private', { method: 'GET', handler: async c => c.json({ visibility: 'private' }) }),
          registerApiRoute('/custom/public', {
            method: 'GET',
            requiresAuth: false,
            handler: async c => c.json({ visibility: 'public' }),
          }),
        ],
      },
    });
    const { GET } = createSvelteKitRouteHandler({ mastra });

    expect((await GET(makeEvent('/custom/private'))).status).toBe(401);
    expect((await GET(makeEvent('/custom/public'))).status).toBe(200);

    const authenticated = await GET(makeEvent('/custom/private', { headers: { authorization: 'Bearer valid-token' } }));
    expect(authenticated.status).toBe(200);
    await expect(authenticated.json()).resolves.toEqual({ visibility: 'private' });
  });

  it('runs server.middleware', async () => {
    const mastra = createTestMastra({
      server: {
        middleware: async (c, next) => {
          await next();
          c.header('x-from-middleware', 'yes');
        },
      },
    });
    const { GET } = createSvelteKitRouteHandler({ mastra });

    const response = await GET(makeEvent('/api/agents'));

    expect(response.headers.get('x-from-middleware')).toBe('yes');
  });

  it('streams response bodies without buffering them', async () => {
    let releaseSecondChunk!: () => void;
    const secondChunkReleased = new Promise<void>(resolve => (releaseSecondChunk = resolve));
    const encoder = new TextEncoder();

    const mastra = createTestMastra({
      server: {
        apiRoutes: [
          registerApiRoute('/stream', {
            method: 'GET',
            requiresAuth: false,
            handler: async () =>
              new Response(
                new ReadableStream({
                  async start(controller) {
                    controller.enqueue(encoder.encode('first'));
                    await secondChunkReleased;
                    controller.enqueue(encoder.encode('second'));
                    controller.close();
                  },
                }),
              ),
          }),
        ],
      },
    });
    const { GET } = createSvelteKitRouteHandler({ mastra });

    const response = await GET(makeEvent('/stream'));
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();

    // The first chunk must arrive while the handler is still producing the rest of the stream.
    const first = await reader.read();
    expect(decoder.decode(first.value)).toBe('first');

    releaseSecondChunk();
    const second = await reader.read();
    expect(decoder.decode(second.value)).toBe('second');
    expect((await reader.read()).done).toBe(true);
  });

  describe('lazy initialization', () => {
    it('does not initialize the server until the first request', async () => {
      const init = vi.spyOn(MastraServer.prototype, 'init');
      const { GET } = createSvelteKitRouteHandler({ mastra: createTestMastra() });

      expect(init).not.toHaveBeenCalled();

      await GET(makeEvent('/api/agents'));

      expect(init).toHaveBeenCalledTimes(1);
    });

    it('initializes once for concurrent and subsequent requests', async () => {
      const init = vi.spyOn(MastraServer.prototype, 'init');
      const { GET } = createSvelteKitRouteHandler({ mastra: createTestMastra() });

      const responses = await Promise.all([GET(makeEvent('/api/agents')), GET(makeEvent('/api/agents'))]);
      await GET(makeEvent('/api/agents'));

      expect(responses.map(response => response.status)).toEqual([200, 200]);
      expect(init).toHaveBeenCalledTimes(1);
    });

    it('retries initialization after a failure instead of caching it', async () => {
      const init = vi.spyOn(MastraServer.prototype, 'init').mockRejectedValueOnce(new Error('storage unavailable'));
      const { GET } = createSvelteKitRouteHandler({ mastra: createTestMastra() });

      await expect(GET(makeEvent('/api/agents'))).rejects.toThrow('storage unavailable');

      const response = await GET(makeEvent('/api/agents'));

      expect(response.status).toBe(200);
      expect(init).toHaveBeenCalledTimes(2);
    });
  });
});
