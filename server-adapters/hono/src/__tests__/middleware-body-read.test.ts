import { Mastra } from '@mastra/core';
import type { IFGAProvider } from '@mastra/core/auth/ee';
import { MASTRA_AUTH_MODE_KEY } from '@mastra/server/server-adapter';
import { Hono } from 'hono';
import type { Context } from 'hono';
import { describe, expect, it, vi } from 'vitest';

import { MastraServer } from '../index';

type MiddlewareFn = (c: any, next: () => Promise<void>) => Promise<void>;

describe('custom API routes without FGA', () => {
  it('does not parse JSON again for FGA after request-context extraction', async () => {
    const mastra = new Mastra({
      logger: false,
      server: { apiRoutes: [{ method: 'POST', path: '/json', handler: async c => c.text(await c.req.text()) }] },
    });
    const app = new Hono();
    await new MastraServer({ app, mastra }).init();
    const json = vi.spyOn(Request.prototype, 'json');
    try {
      const response = await app.request('http://localhost/json', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{"id":"body-id"}',
      });
      expect(response.status).toBe(200);
      expect(await response.text()).toBe('{"id":"body-id"}');
      // Context middleware still reads JSON; FGA must not add a second read.
      expect(json).toHaveBeenCalledTimes(1);
    } finally {
      json.mockRestore();
    }
  });

  it.each([
    [
      'multipart/form-data; boundary=upload',
      '--upload\r\nContent-Disposition: form-data; name="id"\r\n\r\nbody-id\r\n--upload--\r\n',
    ],
    ['application/x-www-form-urlencoded', 'id=body-id'],
  ])('enters the handler before EOF for %s', async (contentType, body) => {
    let enter!: () => void;
    const entered = new Promise<void>(resolve => {
      enter = resolve;
    });
    const mastra = new Mastra({
      logger: false,
      server: {
        apiRoutes: [
          {
            method: 'POST',
            path: '/upload',
            handler: async c => {
              enter();
              return c.text(await c.req.text());
            },
          },
        ],
      },
    });
    const app = new Hono();
    await new MastraServer({ app, mastra }).init();
    let controller!: ReadableStreamDefaultController<Uint8Array>;
    const stream = new ReadableStream<Uint8Array>({
      start(value) {
        controller = value;
      },
    });
    const bytes = new TextEncoder().encode(body);
    controller.enqueue(bytes.slice(0, 1));
    const request = new Request('http://localhost/upload', {
      method: 'POST',
      headers: { 'content-type': contentType },
      body: stream,
      duplex: 'half',
    } as RequestInit & { duplex: 'half' });
    const response = app.request(request);
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        entered,
        new Promise<never>((_, reject) => {
          timeout = setTimeout(() => reject(new Error('Handler waited for request EOF')), 1000);
        }),
      ]);
    } finally {
      clearTimeout(timeout);
      controller.enqueue(bytes.slice(1));
      controller.close();
      await response;
    }
    expect((await response).status).toBe(200);
    expect(await (await response).text()).toBe(body);
  });
});

describe('custom API routes with FGA', () => {
  it.each([
    ['server', true, false],
    ['server', false, false],
    ['server', true, true],
    ['studio', true, false],
    ['studio', false, false],
    ['studio-fallback', true, false],
  ] as const)('preserves body authorization with %s (allowed=%s, resolver=%s)', async (mode, allowed, useResolver) => {
    const check = vi.fn().mockResolvedValue(allowed);
    const config = { resourceType: 'fund', resourceIdParam: 'id', permission: 'fund:write' };
    const resolveRouteFGA = vi.fn().mockReturnValue(config);
    const provider: IFGAProvider = {
      check,
      require: vi.fn(),
      filterAccessible: vi.fn(),
      ...(useResolver ? { resolveRouteFGA } : {}),
    };
    const handler = vi.fn(async (c: Context) => {
      const form = await c.req.formData();
      const file = form.get('file');
      expect(file).toBeInstanceOf(File);
      return c.json({ id: form.get('id'), file: file instanceof File ? await file.text() : null });
    });
    const mastra = new Mastra({
      logger: false,
      ...(mode === 'studio' ? { studio: { fga: provider } } : {}),
      server: {
        ...(mode !== 'studio' ? { fga: provider } : {}),
        middleware: [
          async (c, next) => {
            c.get('requestContext').set('user', { id: 'user-1' });
            if (mode !== 'server') c.get('requestContext').set(MASTRA_AUTH_MODE_KEY, 'studio');
            await next();
          },
        ],
        apiRoutes: [{ method: 'POST', path: '/funds/:id/upload', handler, ...(useResolver ? {} : { fga: config }) }],
      },
    });
    const app = new Hono();
    await new MastraServer({ app, mastra }).init();
    const body = new FormData();
    body.set('id', 'body-id');
    body.set('file', new File(['upload contents'], 'upload.txt'));
    const response = await app.request('http://localhost/funds/path-id/upload?id=query-id', { method: 'POST', body });
    expect(response.status).toBe(allowed ? 200 : 403);
    expect(check).toHaveBeenCalledWith(
      { id: 'user-1' },
      expect.objectContaining({
        resource: { type: 'fund', id: 'body-id' },
        permission: 'fund:write',
      }),
    );
    if (useResolver)
      expect(resolveRouteFGA).toHaveBeenCalledWith(
        expect.objectContaining({
          params: expect.objectContaining({ id: 'body-id' }),
        }),
      );
    if (allowed) {
      expect(handler).toHaveBeenCalledOnce();
      expect(await response.json()).toEqual({ id: 'body-id', file: 'upload contents' });
    } else {
      expect(handler).not.toHaveBeenCalled();
    }
  });
});

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

  it('delivers multipart bodies after middleware consumes them', async () => {
    const app = await buildApp(async (c, next) => {
      await c.req.formData();
      await next();
    });
    const body = new FormData();
    body.set('id', 'body-id');
    const response = await app.request('http://localhost/echo-form', { method: 'POST', body });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ received: { id: 'body-id' } });
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
