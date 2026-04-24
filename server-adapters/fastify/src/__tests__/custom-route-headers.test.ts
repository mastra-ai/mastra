import { Mastra } from '@mastra/core';
import { registerApiRoute } from '@mastra/core/server';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MastraServer } from '../index';

describe('Fastify Adapter — custom API route header preservation across reply.hijack()', () => {
  let app: FastifyInstance;

  beforeEach(() => {
    app = Fastify({ logger: false });
  });

  afterEach(async () => {
    await app.close();
  });

  it('preserves headers set by Fastify hooks (e.g. CORS) on custom API route responses', async () => {
    // Simulates what @fastify/cors does: set Access-Control-Allow-Origin via
    // onRequest hook. Before the fix, writeCustomRouteResponse called
    // nodeRes.writeHead(status, headers) after reply.hijack(), overwriting any
    // headers Fastify plugins had set on the reply.
    app.addHook('onRequest', (_request, reply, done) => {
      void reply.header('access-control-allow-origin', 'https://example.test');
      void reply.header('x-plugin-header', 'plugin-value');
      done();
    });

    const mastra = new Mastra({});
    const adapter = new MastraServer({
      app,
      mastra,
      customApiRoutes: [
        registerApiRoute('/hello', {
          method: 'GET',
          requiresAuth: false,
          handler: async c => c.json({ ok: true }),
        }),
      ],
    });
    await adapter.init();
    await app.ready();

    const response = await app.inject({ method: 'GET', url: '/hello' });

    expect(response.statusCode).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBe('https://example.test');
    expect(response.headers['x-plugin-header']).toBe('plugin-value');
    expect(response.json()).toEqual({ ok: true });
  });

  it('lets custom route handler override plugin-set headers on conflict', async () => {
    // If both the plugin and the route handler set the same header, the route
    // handler's value wins. This matches the existing stream() behavior where
    // stream-specific headers override any plugin-set collisions.
    app.addHook('onRequest', (_request, reply, done) => {
      void reply.header('x-shared', 'from-plugin');
      done();
    });

    const mastra = new Mastra({});
    const adapter = new MastraServer({
      app,
      mastra,
      customApiRoutes: [
        registerApiRoute('/override', {
          method: 'GET',
          requiresAuth: false,
          handler: async c => {
            c.header('x-shared', 'from-handler');
            return c.json({ ok: true });
          },
        }),
      ],
    });
    await adapter.init();
    await app.ready();

    const response = await app.inject({ method: 'GET', url: '/override' });

    expect(response.statusCode).toBe(200);
    expect(response.headers['x-shared']).toBe('from-handler');
  });

  it('preserves multi-value headers set by plugins (e.g. Vary)', async () => {
    app.addHook('onRequest', (_request, reply, done) => {
      void reply.header('vary', ['Origin', 'Accept-Encoding']);
      done();
    });

    const mastra = new Mastra({});
    const adapter = new MastraServer({
      app,
      mastra,
      customApiRoutes: [
        registerApiRoute('/multi', {
          method: 'GET',
          requiresAuth: false,
          handler: async c => c.json({ ok: true }),
        }),
      ],
    });
    await adapter.init();
    await app.ready();

    const response = await app.inject({ method: 'GET', url: '/multi' });

    expect(response.statusCode).toBe(200);
    const vary = response.headers['vary'];
    const varyStr = Array.isArray(vary) ? vary.join(', ') : vary;
    expect(varyStr).toContain('Origin');
    expect(varyStr).toContain('Accept-Encoding');
  });

  it('appends plugin-set Set-Cookie values alongside handler-set cookies', async () => {
    // Set-Cookie is special: distinct cookies must coexist, not collide.
    // Fetch Headers treats "set-cookie" as a single slot under .has(), so the
    // adapter special-cases it to always append plugin cookies.
    app.addHook('onRequest', (_request, reply, done) => {
      void reply.header('set-cookie', 'plugin_cookie=plugin_value; Path=/');
      done();
    });

    const mastra = new Mastra({});
    const adapter = new MastraServer({
      app,
      mastra,
      customApiRoutes: [
        registerApiRoute('/cookies', {
          method: 'GET',
          requiresAuth: false,
          handler: async () =>
            new Response(JSON.stringify({ ok: true }), {
              status: 200,
              headers: {
                'content-type': 'application/json',
                'set-cookie': 'handler_cookie=handler_value; Path=/',
              },
            }),
        }),
      ],
    });
    await adapter.init();
    await app.ready();

    const response = await app.inject({ method: 'GET', url: '/cookies' });

    expect(response.statusCode).toBe(200);
    const rawSetCookie = response.headers['set-cookie'];
    const cookies = Array.isArray(rawSetCookie) ? rawSetCookie : rawSetCookie ? [rawSetCookie] : [];
    const joined = cookies.join('\n');
    expect(joined).toContain('plugin_cookie=plugin_value');
    expect(joined).toContain('handler_cookie=handler_value');
  });

  it('does not leak framing headers (content-length / transfer-encoding) from the reply', async () => {
    // writeCustomRouteResponse → Node's writeHead owns framing headers. If a
    // hook accidentally pre-sets them on the reply, they must not propagate
    // to the hijacked response.
    app.addHook('onRequest', (_request, reply, done) => {
      void reply.header('content-length', '999');
      void reply.header('transfer-encoding', 'chunked');
      void reply.header('x-keep-me', 'kept');
      done();
    });

    const mastra = new Mastra({});
    const adapter = new MastraServer({
      app,
      mastra,
      customApiRoutes: [
        registerApiRoute('/framing', {
          method: 'GET',
          requiresAuth: false,
          handler: async c => c.json({ ok: true }),
        }),
      ],
    });
    await adapter.init();
    await app.ready();

    const response = await app.inject({ method: 'GET', url: '/framing' });

    expect(response.statusCode).toBe(200);
    // Non-framing hook headers still pass through.
    expect(response.headers['x-keep-me']).toBe('kept');
    // Framing headers reflect the actual body, not the hook's bogus 999.
    expect(response.headers['content-length']).not.toBe('999');
  });
});
