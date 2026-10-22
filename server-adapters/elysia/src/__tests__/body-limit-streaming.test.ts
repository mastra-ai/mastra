import { Mastra } from '@mastra/core/mastra';
import type { ServerRoute } from '@mastra/server/server-adapter';
import { Elysia } from 'elysia';
import { describe, expect, it } from 'vitest';
import { MastraServer } from '../index';

const MAX_SIZE = 1024;
const CHUNK_SIZE = 64 * 1024;
const OVERSIZED_TOTAL = 8 * 1024 * 1024;

function createMastra(withAuth: boolean) {
  const mastra = new Mastra({ logger: false });
  if (withAuth) {
    const getServer = mastra.getServer.bind(mastra);
    mastra.getServer = () =>
      ({
        ...getServer(),
        auth: {
          authenticateToken: async (token: string) => (token === 'valid-token' ? { id: 'user' } : null),
          authorize: async () => true,
        },
      }) as any;
  }
  return mastra;
}

/** Streams `total` bytes in fixed chunks and records how many the server pulled. */
function streamBody(total: number, pulled: { bytes: number }) {
  let sent = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (sent >= total) return controller.close();
      const chunk = new Uint8Array(Math.min(CHUNK_SIZE, total - sent)).fill(120);
      sent += chunk.byteLength;
      pulled.bytes += chunk.byteLength;
      controller.enqueue(chunk);
    },
  });
}

async function sendStreamedRequest(options: {
  withAuth: boolean;
  contentType: string;
  total: number;
  contentLength?: boolean;
  headers?: Record<string, string>;
}) {
  const app = new Elysia();
  const adapter = new MastraServer({
    app,
    mastra: createMastra(options.withAuth),
    bodyLimitOptions: { maxSize: MAX_SIZE, onError: error => error },
  });
  app.derive(adapter.createContextMiddleware());

  let handlerCalled = false;
  const route: ServerRoute<any, any, any> = {
    method: 'POST',
    path: '/api/body-limit',
    responseType: 'json',
    requiresAuth: options.withAuth,
    handler: async () => {
      handlerCalled = true;
      return { ok: true };
    },
  };
  await adapter.registerRoute(app as any, route, { prefix: '' });

  const pulled = { bytes: 0 };
  const headers: Record<string, string> = { 'content-type': options.contentType, ...options.headers };
  if (options.contentLength) headers['content-length'] = String(options.total);

  const response = await app.handle(
    new Request('http://localhost/api/body-limit', {
      method: 'POST',
      headers,
      body: streamBody(options.total, pulled),
      duplex: 'half',
    } as RequestInit),
  );

  return { status: response.status, handlerCalled, bytesPulled: pulled.bytes };
}

describe('Elysia body limit with streamed request bodies', () => {
  it.each(['application/json', 'text/plain', 'application/octet-stream'])(
    'rejects an oversized %s body without Content-Length after reading at most the limit',
    async contentType => {
      const result = await sendStreamedRequest({ withAuth: false, contentType, total: OVERSIZED_TOTAL });

      expect(result.status).toBe(413);
      expect(result.handlerCalled).toBe(false);
      expect(result.bytesPulled).toBeLessThanOrEqual(MAX_SIZE + 2 * CHUNK_SIZE);
    },
  );

  it('rejects an oversized declared Content-Length without reading the body', async () => {
    const result = await sendStreamedRequest({
      withAuth: false,
      contentType: 'application/json',
      total: OVERSIZED_TOTAL,
      contentLength: true,
    });

    expect(result.status).toBe(413);
    expect(result.handlerCalled).toBe(false);
    expect(result.bytesPulled).toBeLessThanOrEqual(2 * CHUNK_SIZE);
  });

  it('enforces auth on the protected route for small bodies', async () => {
    const result = await sendStreamedRequest({ withAuth: true, contentType: 'text/plain', total: 100 });

    expect(result.status).toBe(401);
    expect(result.handlerCalled).toBe(false);
  });

  it('rejects an oversized unauthenticated body with 413 before auth, without reading it in full', async () => {
    const result = await sendStreamedRequest({
      withAuth: true,
      contentType: 'text/plain',
      total: OVERSIZED_TOTAL,
    });

    expect(result.status).toBe(413);
    expect(result.handlerCalled).toBe(false);
    expect(result.bytesPulled).toBeLessThanOrEqual(MAX_SIZE + 2 * CHUNK_SIZE);
  });
});
