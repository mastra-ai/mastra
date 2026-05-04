import type { AdapterTestContext } from '@internal/server-adapter-test-utils';
import { createDefaultTestContext } from '@internal/server-adapter-test-utils';
import { Hono } from 'hono';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { z } from 'zod';
import { MastraServer } from '../index';

describe('Validation Error Hook', () => {
  let context: AdapterTestContext;

  const bodySchema = z.object({
    name: z.string().min(1),
    age: z.number().int().positive(),
  });

  beforeEach(async () => {
    context = await createDefaultTestContext();
  });

  function mockServerHook(hook: any) {
    const originalGetServer = context.mastra.getServer.bind(context.mastra);
    vi.spyOn(context.mastra, 'getServer').mockImplementation(() => {
      const server = originalGetServer();
      return { ...server, onValidationError: hook };
    });
  }

  async function registerTestRoute(
    app: Hono,
    overrides?: { onValidationError?: any; queryParamSchema?: any; pathParamSchema?: any; path?: string },
  ) {
    const adapter = new MastraServer({
      app,
      mastra: context.mastra,
      tools: context.tools,
      taskStore: context.taskStore,
    });

    const route = {
      method: 'POST' as const,
      path: overrides?.path ?? '/test/validate',
      responseType: 'json' as const,
      bodySchema,
      queryParamSchema: overrides?.queryParamSchema,
      pathParamSchema: overrides?.pathParamSchema,
      handler: async (params: any) => ({ ok: true, name: params.name, age: params.age }),
      onValidationError: overrides?.onValidationError,
    };

    await adapter.registerRoute(app, route, { prefix: '' });
    return adapter;
  }

  function postInvalidBody(app: Hono, path = '/test/validate') {
    return app.request(
      new Request(`http://localhost${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 123, age: 'bad' }),
      }),
    );
  }

  describe('server-level onValidationError', () => {
    it('should use custom hook response for body validation errors', async () => {
      const hook = vi.fn().mockReturnValue({
        status: 422,
        body: { ok: false, source: 'custom' },
      });

      mockServerHook(hook);
      const app = new Hono();
      await registerTestRoute(app);

      const response = await postInvalidBody(app);

      expect(response.status).toBe(422);
      const data = await response.json();
      expect(data).toEqual({ ok: false, source: 'custom' });
      expect(hook).toHaveBeenCalledWith(expect.any(z.ZodError), 'body');
    });

    it('should use custom hook response for query validation errors', async () => {
      const hook = vi.fn().mockReturnValue({
        status: 422,
        body: { ok: false, type: 'query_error' },
      });

      mockServerHook(hook);
      const app = new Hono();
      await registerTestRoute(app, {
        path: '/test/query',
        queryParamSchema: z.object({ page: z.coerce.number() }),
      });

      const response = await app.request(
        new Request('http://localhost/test/query?page=not-a-number', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'Alice', age: 30 }),
        }),
      );

      expect(response.status).toBe(422);
      const data = await response.json();
      expect(data).toEqual({ ok: false, type: 'query_error' });
      expect(hook).toHaveBeenCalledWith(expect.any(z.ZodError), 'query');
    });

    it('should use custom hook response for path validation errors', async () => {
      const hook = vi.fn().mockReturnValue({
        status: 422,
        body: { ok: false, type: 'path_error' },
      });

      mockServerHook(hook);
      const app = new Hono();
      await registerTestRoute(app, {
        path: '/test/:id',
        pathParamSchema: z.object({ id: z.coerce.number() }),
      });

      const response = await app.request(
        new Request('http://localhost/test/not-a-number', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'Alice', age: 30 }),
        }),
      );

      expect(response.status).toBe(422);
      const data = await response.json();
      expect(data).toEqual({ ok: false, type: 'path_error' });
      expect(hook).toHaveBeenCalledWith(expect.any(z.ZodError), 'path');
    });

    it('should fall back to default when hook returns undefined', async () => {
      const hook = vi.fn().mockReturnValue(undefined);

      mockServerHook(hook);
      const app = new Hono();
      await registerTestRoute(app);

      const response = await postInvalidBody(app);

      expect(hook).toHaveBeenCalledTimes(1);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Invalid request body');
      expect(data.issues).toBeInstanceOf(Array);
    });

    it('should fall back to default when hook throws', async () => {
      const hook = vi.fn().mockImplementation(() => {
        throw new Error('hook crashed');
      });

      mockServerHook(hook);
      const app = new Hono();
      await registerTestRoute(app);

      const response = await postInvalidBody(app);

      expect(hook).toHaveBeenCalledTimes(1);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Invalid request body');
      expect(data.issues).toBeInstanceOf(Array);
    });
  });

  describe('route-level onValidationError', () => {
    it('should use route-level hook instead of server-level hook', async () => {
      const serverHook = vi.fn().mockReturnValue({
        status: 422,
        body: { source: 'server' },
      });

      const routeHook = vi.fn().mockReturnValue({
        status: 418,
        body: { source: 'route' },
      });

      mockServerHook(serverHook);
      const app = new Hono();
      await registerTestRoute(app, { onValidationError: routeHook });

      const response = await postInvalidBody(app);

      expect(response.status).toBe(418);
      const data = await response.json();
      expect(data).toEqual({ source: 'route' });
      expect(routeHook).toHaveBeenCalledWith(expect.any(z.ZodError), 'body');
      expect(serverHook).not.toHaveBeenCalled();
    });

    it('should pass ZodError with correct issues to route hook', async () => {
      const routeHook = vi.fn().mockReturnValue({
        status: 422,
        body: { ok: false },
      });

      const app = new Hono();
      await registerTestRoute(app, { onValidationError: routeHook });

      await postInvalidBody(app);

      expect(routeHook).toHaveBeenCalledTimes(1);
      const [error, ctx] = routeHook.mock.calls[0]!;
      expect(error).toBeInstanceOf(z.ZodError);
      expect(error.issues.length).toBeGreaterThan(0);
      expect(ctx).toBe('body');
    });
  });

  describe('default behavior (no hook)', () => {
    it('should return standard 400 response when no hook is configured', async () => {
      const app = new Hono();
      await registerTestRoute(app);

      const response = await postInvalidBody(app);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Invalid request body');
      expect(data.issues).toBeInstanceOf(Array);
      expect(data.issues.length).toBeGreaterThan(0);
    });
  });
});
