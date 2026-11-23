import type { Server } from 'node:http';
import { serve } from '@hono/node-server';
import { Mastra } from '@mastra/core/mastra';
import type { ServerRoute } from '@mastra/server/server-adapter';
import { createStreamDisconnectTestSuite } from '@mastra/server-adapters-test-suite';
import { Hono } from 'hono';
import { afterEach, describe, expect, it } from 'vitest';
import { MastraServer } from '../index';
import type { HonoBindings, HonoVariables } from '../index';

async function startServer(route: ServerRoute<any, any, any>, beforeContext?: () => Promise<void>) {
  const app = new Hono<{ Bindings: HonoBindings; Variables: HonoVariables }>();
  const adapter = new MastraServer({ app, mastra: new Mastra({ logger: false }) });
  if (beforeContext) {
    app.use('*', async (_c, next) => {
      await beforeContext();
      await next();
    });
  }
  app.use('*', adapter.createContextMiddleware());
  await adapter.registerRoute(app, route, { prefix: '' });
  const server = await new Promise<Server>(resolve => {
    const started = serve({ fetch: app.fetch, hostname: '127.0.0.1', port: 0 }, () => resolve(started as Server));
  });
  const address = server.address();

  if (!address || typeof address === 'string') {
    throw new Error('Expected TCP listener');
  }

  return {
    url: `http://127.0.0.1:${address.port}${route.path}`,
    close: async () => {
      server.closeAllConnections();
      await new Promise<void>(resolve => server.close(() => resolve()));
    },
  };
}

createStreamDisconnectTestSuite({
  startServer: (route, { beforeContext } = {}) => startServer(route, beforeContext),
  // The adapter hands the route's Response to @hono/node-server unchanged, and its response error handler destroys
  // the socket when the body errors after the headers went out.
  datastreamUpstreamErrorDropsConnection: true,
});

// The deployer serves @mastra/hono, and its default CORS exposes Content-Length to browsers. A small, complete
// `datastream-response` body (auth routes, the A2A agent card) must keep the length and content type it has on Hono.
describe('Hono datastream-response headers', () => {
  let close: (() => Promise<void>) | undefined;

  afterEach(async () => {
    await close?.();
    close = undefined;
  });

  it.each([
    ['text', () => new Response('hello world'), '11', 'text/plain; charset=UTF-8'],
    ['bytes', () => new Response(new TextEncoder().encode('hello world')), '11', 'text/plain; charset=UTF-8'],
    ['JSON', () => Response.json({ a: 1 }), '7', 'application/json'],
  ])('keeps Content-Length and the content type of a %s body', async (_kind, body, length, contentType) => {
    const server = await startServer({
      method: 'GET',
      path: '/test/datastream-headers',
      responseType: 'datastream-response',
      handler: async () => body(),
    });
    close = server.close;

    const response = await fetch(server.url);

    expect(response.headers.get('content-length')).toBe(length);
    expect(response.headers.get('content-type')).toBe(contentType);
  });
});
