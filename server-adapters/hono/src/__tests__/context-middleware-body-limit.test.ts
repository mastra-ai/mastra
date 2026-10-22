import { Mastra } from '@mastra/core/mastra';
import type { RequestContext } from '@mastra/core/request-context';
import type { ServerRoute } from '@mastra/server/server-adapter';
import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';

import { MastraServer } from '../index';

// The context middleware runs on every request before route-level bodyLimit and
// before auth. These tests check that its requestContext lookup cannot be used to
// make the server buffer an oversized body.

const MAX_SIZE = 1024;
const CHUNK_SIZE = 64 * 1024;
const OVERSIZED_TOTAL = 8 * 1024 * 1024;
// A tee'd clone may prefetch a chunk or two beyond the one that crossed the limit.
const READ_BOUND = MAX_SIZE + 3 * CHUNK_SIZE;

type Probe = { auth: number; handler: number; customHandler: number };

async function createApp({ auth = false, customRoute = false } = {}) {
  const probe: Probe = { auth: 0, handler: 0, customHandler: 0 };
  const mastra = new Mastra({
    logger: false,
    server: customRoute
      ? {
          apiRoutes: [
            {
              method: 'POST',
              path: '/custom',
              requiresAuth: auth,
              handler: async c => {
                probe.customHandler++;
                return c.json({ ok: true });
              },
            },
          ],
        }
      : undefined,
  });
  if (auth) {
    const getServer = mastra.getServer.bind(mastra);
    mastra.getServer = () =>
      ({
        ...getServer(),
        auth: {
          authenticateToken: async (token: string) => {
            probe.auth++;
            return token === 'valid' ? { id: 'user' } : null;
          },
          authorize: async () => true,
        },
      }) as ReturnType<Mastra['getServer']>;
  }

  const app = new Hono();
  const adapter = new MastraServer({
    app,
    mastra,
    bodyLimitOptions: { maxSize: MAX_SIZE, onError: error => error },
  });
  await adapter.init();

  const handler: ServerRoute<any, any, any>['handler'] = async ({ requestContext }) => {
    probe.handler++;
    return { tenant: (requestContext as RequestContext).get('tenant') ?? null };
  };
  const routes: ServerRoute<any, any, any>[] = [
    { method: 'POST', path: '/api/limited', responseType: 'json', requiresAuth: auth, handler },
    // Route limit above the global limit: requestContext must still be read up to it.
    {
      method: 'POST',
      path: '/api/large',
      responseType: 'json',
      requiresAuth: false,
      maxBodySize: 64 * 1024,
      handler,
    },
  ];
  for (const route of routes) {
    await adapter.registerRoute(app as any, route, { prefix: '' });
  }
  return { app, probe };
}

function countedStream(total: number) {
  const counter = { pulled: 0 };
  const stream = new ReadableStream<Uint8Array>(
    {
      pull(controller) {
        if (counter.pulled >= total) return controller.close();
        const chunk = new Uint8Array(Math.min(CHUNK_SIZE, total - counter.pulled)).fill(0x20);
        counter.pulled += chunk.byteLength;
        controller.enqueue(chunk);
      },
    },
    { highWaterMark: 0 },
  );
  return { stream, counter };
}

function oversizedRequest(path: string, { declareLength }: { declareLength: boolean }) {
  const { stream, counter } = countedStream(OVERSIZED_TOTAL);
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (declareLength) headers['content-length'] = String(OVERSIZED_TOTAL);
  const request = new Request(`http://localhost${path}`, {
    method: 'POST',
    headers,
    body: stream,
    duplex: 'half',
  } as RequestInit & { duplex: 'half' });
  return { request, counter };
}

describe('context middleware body reads respect the body limit', () => {
  it('rejects an oversized declared Content-Length without reading the body', async () => {
    const { app, probe } = await createApp();
    const { request, counter } = oversizedRequest('/api/limited', { declareLength: true });

    const response = await app.fetch(request);

    expect(response.status).toBe(413);
    expect(counter.pulled).toBe(0);
    expect(probe.handler).toBe(0);
  });

  it('stops reading a chunked JSON body without Content-Length near the limit', async () => {
    const { app, probe } = await createApp();
    const { request, counter } = oversizedRequest('/api/limited', { declareLength: false });

    const response = await app.fetch(request);

    expect(response.status).toBe(413);
    expect(counter.pulled).toBeLessThanOrEqual(READ_BOUND);
    expect(probe.handler).toBe(0);
  });

  it.each([true, false])(
    'returns 413 before auth for an unauthenticated oversized body (Content-Length: %s)',
    async declareLength => {
      const { app, probe } = await createApp({ auth: true });
      const { request, counter } = oversizedRequest('/api/limited', { declareLength });

      const response = await app.fetch(request);

      expect(response.status).toBe(413);
      expect(counter.pulled).toBeLessThanOrEqual(READ_BOUND);
      expect(probe.auth).toBe(0);
      expect(probe.handler).toBe(0);
    },
  );

  it.each([true, false])(
    'bounds the read for an unauthenticated oversized custom route body (Content-Length: %s)',
    async declareLength => {
      const { app, probe } = await createApp({ auth: true, customRoute: true });
      const { request, counter } = oversizedRequest('/custom', { declareLength });

      const response = await app.fetch(request);

      expect(response.status).toBe(401);
      expect(counter.pulled).toBeLessThanOrEqual(READ_BOUND);
      expect(probe.customHandler).toBe(0);
    },
  );

  it('still reads requestContext from a body within the limit', async () => {
    const { app } = await createApp({ customRoute: true });

    const response = await app.request('/api/limited', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ requestContext: { tenant: 'acme' } }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ tenant: 'acme' });
  });

  it('reads requestContext up to a route limit above the global limit', async () => {
    const { app } = await createApp();
    const body = JSON.stringify({ requestContext: { tenant: 'acme' }, padding: 'x'.repeat(8 * 1024) });

    const response = await app.request('/api/large', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ tenant: 'acme' });
  });
});
