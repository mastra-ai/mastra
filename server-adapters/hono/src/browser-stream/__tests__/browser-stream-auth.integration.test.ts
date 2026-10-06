import type { Server } from 'node:http';
import { serve } from '@hono/node-server';
import type { Mastra } from '@mastra/core/mastra';
import type { MastraAuthConfig } from '@mastra/core/server';
import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import WebSocket from 'ws';

import { setupBrowserStream } from '../index.js';

const authConfig: MastraAuthConfig = {
  authenticateToken: async (token, request) => {
    // `MastraAuthRequest` may be a fetch `Request` or a `HonoRequestLike`; only the
    // latter exposes `header()`, which is what the adapter passes.
    const cookie = (request as { header?: (name: string) => string | undefined }).header?.('cookie');
    const credential = token || cookie?.match(/session=([^;]+)/)?.[1];
    return credential === 'valid-token' ? { id: 'user-1', role: 'user' } : null;
  },
};

function createStubMastra(auth?: MastraAuthConfig): Mastra {
  return {
    getServer: () => ({ auth }),
    getStudio: () => undefined,
    getLogger: () => undefined,
  } as unknown as Mastra;
}

interface HandshakeResult {
  opened: boolean;
  status?: number;
  error?: string;
}

/**
 * Drive a real WebSocket handshake against a real HTTP server — the exact path the
 * reported vulnerability used. `@hono/node-ws` handles the upgrade by routing the
 * request back through `app.request`, so a failed auth check surfaces as a non-101
 * HTTP response and the socket is closed before any screencast frame is sent.
 */
function handshake(url: string, headers?: Record<string, string>): Promise<HandshakeResult> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url, { headers });
    const timer = setTimeout(() => {
      socket.terminate();
      reject(new Error(`Timed out waiting for handshake result from ${url}`));
    }, 5000);

    socket.on('open', () => {
      clearTimeout(timer);
      socket.close();
      resolve({ opened: true });
    });
    socket.on('unexpected-response', (_request, response) => {
      clearTimeout(timer);
      response.resume();
      resolve({ opened: false, status: response.statusCode });
    });
    socket.on('error', error => {
      clearTimeout(timer);
      resolve({ opened: false, error: error.message });
    });
  });
}

describe('hono browser-stream WebSocket authentication', () => {
  let server: Server;
  let streamUrl: string;

  beforeEach(async () => {
    const app = new Hono();
    const browserStream = await setupBrowserStream(app, {
      mastra: createStubMastra(authConfig),
      getToolset: () => undefined,
    });

    if (!browserStream?.injectWebSocket) {
      throw new Error('Expected @hono/node-ws to be available in this test environment');
    }

    server = serve({ fetch: app.fetch, port: 0 }) as Server;
    browserStream.injectWebSocket(server);

    await new Promise<void>(resolve => server.once('listening', () => resolve()));
    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Failed to get server address');
    }
    streamUrl = `ws://localhost:${address.port}/browser/agent-1/stream?threadId=thread-1`;
  });

  afterEach(async () => {
    await new Promise<void>(resolve => server.close(() => resolve()));
  });

  it('refuses to upgrade an unauthenticated connection', async () => {
    const result = await handshake(streamUrl);

    expect(result.opened).toBe(false);
    expect(result.status).toBe(401);
  });

  it('refuses to upgrade a connection carrying an invalid session cookie', async () => {
    const result = await handshake(streamUrl, { Cookie: 'session=wrong-token' });

    expect(result.opened).toBe(false);
    expect(result.status).toBe(401);
  });

  it('upgrades a connection authenticated with a session cookie', async () => {
    const result = await handshake(streamUrl, { Cookie: 'session=valid-token' });

    expect(result).toEqual({ opened: true });
  });

  it('upgrades a connection authenticated with an apiKey query param', async () => {
    const result = await handshake(`${streamUrl}&apiKey=valid-token`);

    expect(result).toEqual({ opened: true });
  });
});
