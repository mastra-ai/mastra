import { Mastra } from '@mastra/core';
import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';

import { MastraServer } from '../index';

/**
 * `server.middleware` from the Mastra config and middleware added via
 * `mastra.setServerMiddleware()` must run when the app is served through the
 * adapter directly (`new MastraServer(...).init()`), matching the behavior of
 * the deployer-built server.
 */
describe('user middleware registration', () => {
  it('runs `server.middleware` from the Mastra config on custom API routes', async () => {
    let middlewareRan = false;

    const mastra = new Mastra({
      logger: false,
      server: {
        middleware: [
          async (c, next) => {
            middlewareRan = true;
            c.get('requestContext').set('currentDateTime', '2026-08-19 09:00:00 UTC');
            await next();
          },
        ],
        apiRoutes: [
          {
            method: 'GET',
            path: '/probe',
            handler: c =>
              c.json({
                middlewareRan,
                currentDateTime: c.get('requestContext').get('currentDateTime') ?? null,
              }),
          },
        ],
      },
    });

    const app = new Hono();
    await new MastraServer({ app, mastra }).init();

    const response = await app.request('http://localhost/probe');

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      middlewareRan: true,
      currentDateTime: '2026-08-19 09:00:00 UTC',
    });
  });

  it('supports the `{ path, handler }` middleware form and honors the path scope', async () => {
    const calls: string[] = [];

    const mastra = new Mastra({
      logger: false,
      server: {
        middleware: [
          {
            path: '/scoped/*',
            handler: async (_c, next) => {
              calls.push('scoped');
              await next();
            },
          },
        ],
        apiRoutes: [
          { method: 'GET', path: '/scoped/probe', handler: c => c.json({ ok: true }) },
          { method: 'GET', path: '/other/probe', handler: c => c.json({ ok: true }) },
        ],
      },
    });

    const app = new Hono();
    await new MastraServer({ app, mastra }).init();

    await app.request('http://localhost/scoped/probe');
    expect(calls).toEqual(['scoped']);

    await app.request('http://localhost/other/probe');
    expect(calls).toEqual(['scoped']);
  });

  it('does not run user middleware on framework-public routes (`requiresAuth: false`)', async () => {
    const hostileMiddleware = async () => new Response('unauthorized', { status: 401 });

    const mastra = new Mastra({
      logger: false,
      server: {
        middleware: [hostileMiddleware],
        apiRoutes: [
          {
            method: 'GET',
            path: '/public-probe',
            requiresAuth: false,
            handler: c => c.json({ ok: true }),
          },
        ],
      },
    });

    const app = new Hono();
    await new MastraServer({ app, mastra }).init();

    const response = await app.request('http://localhost/public-probe');

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it('runs middleware added via `mastra.setServerMiddleware()` on built-in routes', async () => {
    const mastra = new Mastra({ logger: false });

    // Function form defaults to the `/api/*` path.
    let middlewareRan = false;
    mastra.setServerMiddleware(async (_c, next) => {
      middlewareRan = true;
      await next();
    });

    const app = new Hono();
    await new MastraServer({ app, mastra }).init();

    const response = await app.request('http://localhost/api/agents');

    expect(response.status).toBe(200);
    expect(middlewareRan).toBe(true);
  });
});
