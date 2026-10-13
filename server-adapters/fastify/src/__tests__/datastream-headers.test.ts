import type { ServerRoute } from '@mastra/server/server-adapter';
import { createDefaultTestContext } from '@mastra/server-adapters-test-suite';
import type { AdapterTestContext } from '@mastra/server-adapters-test-suite';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MastraServer } from '../index';

describe('datastream-response headers', () => {
  let context: AdapterTestContext;
  let app: FastifyInstance | null = null;

  beforeEach(async () => {
    context = await createDefaultTestContext();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
      app = null;
    }
  });

  async function setup(body: () => BodyInit | null) {
    app = Fastify();
    const adapter = new MastraServer({ app, mastra: context.mastra });

    const route: ServerRoute<any, any, any> = {
      method: 'GET',
      path: '/test/datastream',
      responseType: 'datastream-response',
      handler: async () => {
        const headers = new Headers({ Location: '/after-login', 'X-Custom': 'custom-value' });
        headers.append('Set-Cookie', 'session=abc; Path=/; HttpOnly');
        headers.append('Set-Cookie', 'pkce=xyz; Path=/');
        return new Response(body(), { status: 302, headers });
      },
    };

    app.addHook('onRequest', async (_req, reply) => {
      reply.header('access-control-allow-origin', 'https://example.com');
    });
    app.addHook('preHandler', adapter.createContextMiddleware());
    await adapter.registerRoute(app, route, { prefix: '' });
    await app.ready();
    return app;
  }

  it('forwards upstream status, headers, multiple cookies and plugin headers with a streamed body', async () => {
    const instance = await setup(
      () =>
        new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('hello'));
            controller.close();
          },
        }),
    );

    const res = await instance.inject({ method: 'GET', url: '/test/datastream' });

    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe('/after-login');
    expect(res.headers['x-custom']).toBe('custom-value');
    expect(res.headers['set-cookie']).toEqual(['session=abc; Path=/; HttpOnly', 'pkce=xyz; Path=/']);
    expect(res.headers['access-control-allow-origin']).toBe('https://example.com');
    expect(res.body).toBe('hello');
  });

  it('forwards headers when the upstream response has no body', async () => {
    const instance = await setup(() => null);

    const res = await instance.inject({ method: 'GET', url: '/test/datastream' });

    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe('/after-login');
    expect(res.headers['set-cookie']).toEqual(['session=abc; Path=/; HttpOnly', 'pkce=xyz; Path=/']);
    expect(res.headers['access-control-allow-origin']).toBe('https://example.com');
  });
});
