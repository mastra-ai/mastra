import type { AdapterTestContext } from '@internal/server-adapter-test-utils';
import { createDefaultTestContext } from '@internal/server-adapter-test-utils';
import { Elysia } from 'elysia';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { z } from 'zod';
import { z as zv3 } from 'zod/v3';
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
    app: Elysia,
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

  function postInvalidBody(app: Elysia, path = '/test/validate') {
    return app.fetch(
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
      const app = new Elysia();
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
      const app = new Elysia();
      await registerTestRoute(app, {
        path: '/test/query',
        queryParamSchema: z.object({ page: z.coerce.number() }),
      });

      const response = await app.fetch(
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
      const app = new Elysia();
      await registerTestRoute(app, {
        path: '/test/:id',
        pathParamSchema: z.object({ id: z.coerce.number() }),
      });

      const response = await app.fetch(
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
      const app = new Elysia();
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
      const app = new Elysia();
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
      const app = new Elysia();
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

      const app = new Elysia();
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
      const app = new Elysia();
      await registerTestRoute(app);

      const response = await postInvalidBody(app);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Invalid request body');
      expect(data.issues).toBeInstanceOf(Array);
      expect(data.issues.length).toBeGreaterThan(0);
    });
  });

  /**
   * Regression coverage for https://github.com/mastra-ai/mastra/issues/17167.
   *
   * When a consumer pins `zod@^3`, route schemas are constructed with v3 `z`
   * and `parseAsync` throws a v3 `ZodError`. The adapter imports `ZodError`
   * from the top-level `zod` (v4 in this repo's graph), so an `instanceof`
   * check across realms returns `false` and the response falls back to:
   *
   *   { error, issues: [{ field: "unknown", message: <stringified zod issues> }] }
   *
   * These tests construct schemas with `zod/v3` while the adapter uses the
   * bundled top-level `zod`, reproducing the dual-instance hazard
   * deterministically and proving the structural ZodError check is in effect.
   */
  describe('dual zod-instance (zod v3 consumer, issue #17167)', () => {
    async function registerV3Route(app: Elysia, route: any) {
      const adapter = new MastraServer({
        app,
        mastra: context.mastra,
        tools: context.tools,
        taskStore: context.taskStore,
      });
      await adapter.registerRoute(app, route, { prefix: '' });
      return adapter;
    }

    it('body schema built with zod v3 produces field-specific issues (not "unknown")', async () => {
      // Mirrors packages/server/src/server/schemas/conversations.ts createConversationBodySchema.
      const bodySchemaV3 = zv3.object({
        agent_id: zv3.string(),
        conversation_id: zv3.string().optional(),
      });

      const app = new Elysia();
      await registerV3Route(app, {
        method: 'POST' as const,
        path: '/v1/conversations',
        responseType: 'json' as const,
        bodySchema: bodySchemaV3,
        handler: async () => ({ ok: true }),
      });

      const response = await app.fetch(
        new Request('http://localhost/v1/conversations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        }),
      );

      expect(response.status).toBe(400);
      const data = await response.json();

      expect(data.error).toBe('Invalid request body');
      expect(Array.isArray(data.issues)).toBe(true);
      expect(data.issues.length).toBeGreaterThan(0);
      expect(data.issues[0].field).toBe('agent_id');
      // Must not be a JSON-stringified issues array.
      expect(data.issues[0].message).not.toMatch(/^\[\s*\{/);
    });

    it('query schema built with zod v3 produces field-specific issues', async () => {
      const queryParamSchemaV3 = zv3.object({ page: zv3.coerce.number() });

      const app = new Elysia();
      await registerV3Route(app, {
        method: 'POST' as const,
        path: '/v1/query-test',
        responseType: 'json' as const,
        queryParamSchema: queryParamSchemaV3,
        handler: async () => ({ ok: true }),
      });

      const response = await app.fetch(
        new Request('http://localhost/v1/query-test?page=not-a-number', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Invalid query parameters');
      expect(data.issues[0].field).toBe('page');
    });

    it('path schema built with zod v3 produces field-specific issues', async () => {
      const pathParamSchemaV3 = zv3.object({ id: zv3.coerce.number() });

      const app = new Elysia();
      await registerV3Route(app, {
        method: 'POST' as const,
        path: '/v1/path-test/:id',
        responseType: 'json' as const,
        pathParamSchema: pathParamSchemaV3,
        handler: async () => ({ ok: true }),
      });

      const response = await app.fetch(
        new Request('http://localhost/v1/path-test/not-a-number', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Invalid path parameters');
      expect(data.issues[0].field).toBe('id');
    });
  });
});
