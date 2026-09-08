import { Mastra } from '@mastra/core';
import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';

import { MastraServer } from '../index';

type MiddlewareFn = (c: any, next: () => Promise<void>) => Promise<void>;

/**
 * Regression tests for https://github.com/mastra-ai/mastra/issues/22596
 *
 * User middleware that consumes the request body before `next()` must not
 * break custom `registerApiRoute` routes. Previously the custom-route bridge
 * forwarded the already-disturbed `c.req.raw.body`, and constructing the
 * internal Request threw "Response body object should not be disturbed or
 * locked", turning every body-bearing custom route into a 500.
 */
describe('custom API routes with body-reading user middleware', () => {
  const buildApp = async (middleware: MiddlewareFn) => {
    const mastra = new Mastra({
      logger: false,
      server: {
        middleware: [middleware],
        apiRoutes: [
          {
            method: 'POST',
            path: '/echo',
            handler: async c => c.json({ received: await c.req.json() }),
          },
          {
            method: 'POST',
            path: '/echo-text',
            handler: async c => c.json({ received: await c.req.text() }),
          },
          {
            method: 'POST',
            path: '/echo-form',
            handler: async c => {
              const form = await c.req.formData();
              return c.json({ received: Object.fromEntries(form) });
            },
          },
        ],
      },
    });

    const app = new Hono();
    await new MastraServer({ app, mastra }).init();
    return app;
  };

  const postJson = (app: Hono, path = '/echo', body: unknown = { hello: 'world' }) =>
    app.request(`http://localhost${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

  it('works when middleware reads the body via c.req.json()', async () => {
    let seenByMiddleware: unknown;
    const app = await buildApp(async (c, next) => {
      seenByMiddleware = await c.req.json();
      await next();
    });

    const response = await postJson(app);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ received: { hello: 'world' } });
    expect(seenByMiddleware).toEqual({ hello: 'world' });
  });

  it('works when middleware reads the body via c.req.text()', async () => {
    const app = await buildApp(async (c, next) => {
      await c.req.text();
      await next();
    });

    const response = await postJson(app);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ received: { hello: 'world' } });
  });

  it('works when middleware reads the raw request body directly', async () => {
    const app = await buildApp(async (c, next) => {
      await c.req.raw.json();
      await next();
    });

    const response = await postJson(app);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ received: { hello: 'world' } });
  });

  it('delivers text bodies to the route after middleware consumed them', async () => {
    const app = await buildApp(async (c, next) => {
      await c.req.text();
      await next();
    });

    const response = await app.request('http://localhost/echo-text', {
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
      body: 'plain body',
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ received: 'plain body' });
  });

  it('delivers form bodies to the route after middleware consumed them', async () => {
    const app = await buildApp(async (c, next) => {
      await c.req.formData();
      await next();
    });

    const response = await app.request('http://localhost/echo-form', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ a: '1', b: '2' }).toString(),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ received: { a: '1', b: '2' } });
  });

  it('still works when middleware does not read the body', async () => {
    const app = await buildApp(async (_c, next) => {
      await next();
    });

    const response = await postJson(app);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ received: { hello: 'world' } });
  });

  it('handles larger bodies read by middleware', async () => {
    const app = await buildApp(async (c, next) => {
      await c.req.json();
      await next();
    });

    const big = { data: 'x'.repeat(64 * 1024) };
    const response = await postJson(app, '/echo', big);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ received: big });
  });

  it('does not interfere with requests when no custom routes are registered', async () => {
    const mastra = new Mastra({
      logger: false,
      server: {
        middleware: [
          async (c: any, next: () => Promise<void>) => {
            await c.req.json().catch(() => undefined);
            await next();
          },
        ],
      },
    });

    const app = new Hono();
    await new MastraServer({ app, mastra }).init();

    const response = await app.request('http://localhost/api/agents');
    expect(response.status).toBe(200);
  });
});
