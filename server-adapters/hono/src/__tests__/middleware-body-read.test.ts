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
        apiRoutes: [{ method: 'POST', path: '/funds/upload', handler, ...(useResolver ? {} : { fga: config }) }],
      },
    });
    const app = new Hono();
    await new MastraServer({ app, mastra }).init();
    const body = new FormData();
    body.set('id', 'body-id');
    body.set('file', new File(['upload contents'], 'upload.txt'));
    const response = await app.request('http://localhost/funds/upload?id=query-id', { method: 'POST', body });
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

/**
 * Regression tests for https://github.com/mastra-ai/mastra/issues/31191
 *
 * `Request.clone()` tees the body stream. The context middleware used to clone
 * every body-bearing request whenever *any* custom route existed, so the unused
 * tee branch retained the whole body until GC — for ordinary routes too, and
 * even when nothing consumed the original. These tests pin the branch lifecycle
 * instead of a memory threshold: only custom-route requests are cloned, the
 * untouched original is forwarded, and an unused adapter-owned branch is
 * cancelled (never awaited) rather than retained.
 */
describe('custom API routes: request-body tee branch lifecycle', () => {
  const encoder = new TextEncoder();

  const timeoutAfter = (ms: number, message: string) =>
    new Promise<never>((_resolve, reject) => setTimeout(() => reject(new Error(message)), ms));

  /** A request whose body is a controlled stream, so a test can hold EOF open. */
  const controlledRequest = (url: string, contentType: string, firstChunk: string) => {
    let controller!: ReadableStreamDefaultController<Uint8Array>;
    const stream = new ReadableStream<Uint8Array>({
      start(value) {
        controller = value;
      },
    });
    controller.enqueue(encoder.encode(firstChunk));
    const request = new Request(url, {
      method: 'POST',
      headers: { 'content-type': contentType },
      body: stream,
      duplex: 'half',
    } as RequestInit & { duplex: 'half' });
    return {
      request,
      push: (chunk: string) => controller.enqueue(encoder.encode(chunk)),
      close: () => controller.close(),
    };
  };

  it('cancels the unread pristine branch and forwards the original for a streamed custom route', async () => {
    let enter!: () => void;
    const entered = new Promise<void>(resolve => {
      enter = resolve;
    });
    let received = '';
    const mastra = new Mastra({
      logger: false,
      server: {
        apiRoutes: [
          {
            method: 'POST',
            path: '/stream',
            handler: async c => {
              enter();
              received = await c.req.text();
              return c.json({ ok: true });
            },
          },
        ],
      },
    });
    const app = new Hono();
    await new MastraServer({ app, mastra }).init();

    const clonedBodies: (ReadableStream | null)[] = [];
    const realClone = Request.prototype.clone;
    const realCancel = ReadableStream.prototype.cancel;
    // Cancellation that never settles: fetch tee cancellation only resolves once
    // the sibling branch drains, so dispatch must not await it.
    const pending = new Promise<never>(() => {});
    // Recorded rather than read from `mock.contexts`: the spy is restored before
    // the assertions, which resets that property.
    const cancelledBodies: ReadableStream[] = [];
    const cloneSpy = vi.spyOn(Request.prototype, 'clone').mockImplementation(function () {
      const clone = realClone.call(this);
      clonedBodies.push(clone.body);
      return clone;
    });
    const cancelSpy = vi.spyOn(ReadableStream.prototype, 'cancel').mockImplementation(function (reason?: unknown) {
      cancelledBodies.push(this as unknown as ReadableStream);
      if (clonedBodies.includes(this as unknown as ReadableStream)) return pending;
      return realCancel.call(this, reason);
    });
    let response: Response;
    try {
      const controlled = controlledRequest('http://localhost/stream', 'application/octet-stream', 'alpha');
      const responsePromise = app.request(controlled.request);
      // The handler must run before the body reaches EOF.
      await Promise.race([entered, timeoutAfter(1000, 'Handler waited for request EOF')]);
      controlled.push('beta');
      controlled.push('gamma');
      controlled.close();
      response = await responsePromise;
    } finally {
      cloneSpy.mockRestore();
      cancelSpy.mockRestore();
    }

    expect(response.status).toBe(200);
    expect(received).toBe('alphabetagamma');
    // Exactly one tee branch was created: the pristine clone.
    expect(clonedBodies).toHaveLength(1);
    // Its unread branch is released rather than retained.
    expect(cancelledBodies).toContain(clonedBodies[0]);
  });

  it('does not clone the request body for ordinary routes when a custom route exists', async () => {
    const mastra = new Mastra({
      logger: false,
      server: {
        apiRoutes: [{ method: 'POST', path: '/custom', handler: async c => c.json({ ok: true }) }],
      },
    });
    const app = new Hono();
    await new MastraServer({ app, mastra }).init();
    let seen = '';
    app.post('/plain', async c => {
      seen = await c.req.text();
      return c.text('ok');
    });

    const cloneSpy = vi.spyOn(Request.prototype, 'clone');
    try {
      const plain = await app.request('http://localhost/plain', {
        method: 'POST',
        headers: { 'content-type': 'application/octet-stream' },
        body: 'plain-payload',
      });
      expect(plain.status).toBe(200);
      expect(await plain.text()).toBe('ok');
      expect(seen).toBe('plain-payload');
      // Ordinary routes must not pay for custom-route body preservation.
      expect(cloneSpy).not.toHaveBeenCalled();

      // A matched custom route still captures its pristine clone.
      const custom = await app.request('http://localhost/custom', {
        method: 'POST',
        headers: { 'content-type': 'application/octet-stream' },
        body: 'custom-payload',
      });
      expect(custom.status).toBe(200);
      expect(cloneSpy).toHaveBeenCalledTimes(1);
    } finally {
      cloneSpy.mockRestore();
    }
  });

  it('keeps the original readable after next() when the handler leaves the body untouched', async () => {
    let seenAfter: string | undefined;
    const mastra = new Mastra({
      logger: false,
      server: {
        middleware: [
          async (c, next) => {
            await next();
            seenAfter = await c.req.text();
          },
        ],
        apiRoutes: [{ method: 'POST', path: '/noop', handler: async c => c.json({ ok: true }) }],
      },
    });
    const app = new Hono();
    await new MastraServer({ app, mastra }).init();

    const response = await app.request('http://localhost/noop', {
      method: 'POST',
      headers: { 'content-type': 'application/octet-stream' },
      body: 'left-intact',
    });

    expect(response.status).toBe(200);
    expect(seenAfter).toBe('left-intact');
  });

  it('lets middleware re-read a Hono-cached body after next() while the handler drains the replay', async () => {
    const seen: unknown[] = [];
    const mastra = new Mastra({
      logger: false,
      server: {
        middleware: [
          async (c, next) => {
            seen.push(await c.req.json());
            await next();
            seen.push(await c.req.json());
          },
        ],
        apiRoutes: [{ method: 'POST', path: '/echo', handler: async c => c.json({ received: await c.req.json() }) }],
      },
    });
    const app = new Hono();
    await new MastraServer({ app, mastra }).init();

    const response = await app.request('http://localhost/echo', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ hello: 'world' }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ received: { hello: 'world' } });
    expect(seen).toEqual([{ hello: 'world' }, { hello: 'world' }]);
  });

  it('forwards the pristine replay and leaves a middleware-locked original alone', async () => {
    let lockedText: string | undefined;
    const mastra = new Mastra({
      logger: false,
      server: {
        middleware: [
          async (c, next) => {
            // A middleware-owned reader locks the original before dispatch.
            const reader = c.req.raw.body!.getReader();
            await next();
            const { value } = await reader.read();
            lockedText = value ? new TextDecoder().decode(value) : undefined;
            reader.releaseLock();
          },
        ],
        apiRoutes: [{ method: 'POST', path: '/locked', handler: async c => c.json({ received: await c.req.text() }) }],
      },
    });
    const app = new Hono();
    await new MastraServer({ app, mastra }).init();

    const response = await app.request('http://localhost/locked', {
      method: 'POST',
      headers: { 'content-type': 'application/octet-stream' },
      body: 'locked-payload',
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ received: 'locked-payload' });
    expect(lockedText).toBe('locked-payload');
  });

  it('releases the pristine branch on an authorization rejection and leaves the original for outer middleware', async () => {
    const check = vi.fn().mockResolvedValue(false);
    const provider: IFGAProvider = {
      check,
      require: vi.fn(),
      filterAccessible: vi.fn(),
    };
    const config = { resourceType: 'fund', resourceIdParam: 'id', permission: 'fund:write' };
    const handler = vi.fn(async (c: Context) => c.json({ ok: true }));
    let seenAfter: string | undefined;
    const mastra = new Mastra({
      logger: false,
      server: {
        fga: provider,
        middleware: [
          async (c, next) => {
            c.get('requestContext').set('user', { id: 'user-1' });
            await next();
            seenAfter = await c.req.text();
          },
        ],
        apiRoutes: [{ method: 'POST', path: '/secured', handler, fga: config }],
      },
    });
    const app = new Hono();
    await new MastraServer({ app, mastra }).init();

    const clonedBodies: (ReadableStream | null)[] = [];
    const realClone = Request.prototype.clone;
    const realCancel = ReadableStream.prototype.cancel;
    // Recorded rather than read from `mock.contexts`: the spy is restored before
    // the assertions, which resets that property.
    const cancelledBodies: ReadableStream[] = [];
    const cloneSpy = vi.spyOn(Request.prototype, 'clone').mockImplementation(function () {
      const clone = realClone.call(this);
      clonedBodies.push(clone.body);
      return clone;
    });
    const cancelSpy = vi.spyOn(ReadableStream.prototype, 'cancel').mockImplementation(function (reason?: unknown) {
      cancelledBodies.push(this as unknown as ReadableStream);
      return realCancel.call(this, reason);
    });
    const payload = JSON.stringify({ id: 'body-id' });
    let response: Response;
    try {
      response = await app.request('http://localhost/secured', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: payload,
      });
    } finally {
      cloneSpy.mockRestore();
      cancelSpy.mockRestore();
    }

    expect(response.status).toBe(403);
    expect(handler).not.toHaveBeenCalled();
    // The pristine clone is the first tee branch; the request-context clone follows.
    expect(clonedBodies[0]).toBeDefined();
    // The never-forwarded adapter-owned branch is released. The FGA read clones
    // the pristine request, and undici's clone re-tees the *source* as well, so
    // the pristine's body after the read is a new stream: assert on the release
    // happening exactly once rather than on the stream captured at clone time.
    expect(cancelledBodies).toHaveLength(1);
    // The untouched original stays readable for outer middleware.
    expect(seenAfter).toBe(payload);
  });

  it('keeps the pristine clone for parameterized custom routes', async () => {
    const mastra = new Mastra({
      logger: false,
      server: {
        middleware: [
          async (c: any, next: () => Promise<void>) => {
            await c.req.json();
            await next();
          },
        ],
        apiRoutes: [
          {
            method: 'POST',
            path: '/items/:id',
            handler: async c => c.json({ id: c.req.param('id'), received: await c.req.json() }),
          },
        ],
      },
    });
    const app = new Hono();
    await new MastraServer({ app, mastra }).init();

    const response = await app.request('http://localhost/items/abc', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'widget' }),
    });

    expect(response.status).toBe(200);
    // The middleware consumed the original, so the handler replays the pristine clone.
    await expect(response.json()).resolves.toEqual({ id: 'abc', received: { name: 'widget' } });
  });

  it('releases the pristine branch before a large streamed body reaches the handler', async () => {
    const chunkSize = 64 * 1024;
    const totalChunks = 64;
    const chunk = 'a'.repeat(chunkSize);
    let bytesRead = 0;
    let releasedAtBytesRead: number | undefined;
    const mastra = new Mastra({
      logger: false,
      server: {
        apiRoutes: [
          {
            method: 'POST',
            path: '/stream-large',
            handler: async c => {
              const reader = c.req.raw.body!.getReader();
              for (;;) {
                const { done, value } = await reader.read();
                if (done) break;
                bytesRead += value!.byteLength;
              }
              return c.json({ bytes: bytesRead });
            },
          },
        ],
      },
    });
    const app = new Hono();
    await new MastraServer({ app, mastra }).init();

    const clonedBodies: (ReadableStream | null)[] = [];
    const realClone = Request.prototype.clone;
    const realCancel = ReadableStream.prototype.cancel;
    const cloneSpy = vi.spyOn(Request.prototype, 'clone').mockImplementation(function () {
      const clone = realClone.call(this);
      clonedBodies.push(clone.body);
      return clone;
    });
    const cancelSpy = vi.spyOn(ReadableStream.prototype, 'cancel').mockImplementation(function (reason?: unknown) {
      if (clonedBodies.includes(this as unknown as ReadableStream)) releasedAtBytesRead = bytesRead;
      return realCancel.call(this, reason);
    });
    let response: Response;
    try {
      const controlled = controlledRequest('http://localhost/stream-large', 'application/octet-stream', chunk);
      const responsePromise = app.request(controlled.request);
      for (let i = 1; i < totalChunks; i++) controlled.push(chunk);
      controlled.close();
      response = await Promise.race([responsePromise, timeoutAfter(10_000, 'large streamed body did not complete')]);
    } finally {
      cloneSpy.mockRestore();
      cancelSpy.mockRestore();
    }

    expect(response.status).toBe(200);
    // Every byte still reaches the handler...
    await expect(response.json()).resolves.toEqual({ bytes: totalChunks * chunkSize });
    // ...and the unused branch is released up front, not after the body was consumed.
    expect(releasedAtBytesRead).toBe(0);
  });
});
