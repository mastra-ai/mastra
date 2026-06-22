/**
 * Regression coverage for https://github.com/mastra-ai/mastra/issues/17167
 * applied to the Fastify adapter. Same diagnosis as Hono/Express/Koa: a
 * consumer pinned to `zod@^3` builds schemas whose `ZodError` is not
 * `instanceof` the v4 `ZodError` bundled with this adapter. The structural
 * `isZodError` check restores the correct field-path response shape.
 */
import type { AdapterTestContext } from '@internal/server-adapter-test-utils';
import { createDefaultTestContext } from '@internal/server-adapter-test-utils';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z as zv3 } from 'zod/v3';
import { MastraServer } from '../index';

describe('Fastify adapter: zod v3 validation errors preserve field path (issue #17167)', () => {
  let context: AdapterTestContext;
  let app: FastifyInstance;
  let adapter: MastraServer;

  beforeEach(async () => {
    context = await createDefaultTestContext();
    app = Fastify();
    adapter = new MastraServer({
      app,
      mastra: context.mastra,
      taskStore: context.taskStore,
    });
    app.addHook('preHandler', adapter.createContextMiddleware());
  });

  afterEach(async () => {
    await app.close();
  });

  it('body schema built with zod v3 produces field-specific issues', async () => {
    const bodySchema = zv3.object({ agent_id: zv3.string() });
    await adapter.registerRoute(
      app,
      {
        method: 'POST',
        path: '/v1/conversations',
        responseType: 'json',
        bodySchema,
        handler: async () => ({ ok: true }),
      } as any,
      { prefix: '' },
    );
    await app.ready();

    const response = await app.inject({
      method: 'POST',
      url: '/v1/conversations',
      headers: { 'content-type': 'application/json' },
      payload: {},
    });

    expect(response.statusCode).toBe(400);
    const data = response.json() as { error: string; issues: Array<{ field: string; message: string }> };
    expect(data.error).toBe('Invalid request body');
    expect(data.issues[0]!.field).toBe('agent_id');
    expect(data.issues[0]!.message).not.toMatch(/^\[\s*\{/);
  });

  it('query schema built with zod v3 produces field-specific issues', async () => {
    const queryParamSchema = zv3.object({ page: zv3.coerce.number() });
    await adapter.registerRoute(
      app,
      {
        method: 'POST',
        path: '/v1/q',
        responseType: 'json',
        queryParamSchema,
        handler: async () => ({ ok: true }),
      } as any,
      { prefix: '' },
    );
    await app.ready();

    const response = await app.inject({
      method: 'POST',
      url: '/v1/q?page=not-a-number',
      headers: { 'content-type': 'application/json' },
      payload: {},
    });

    expect(response.statusCode).toBe(400);
    const data = response.json() as { error: string; issues: Array<{ field: string; message: string }> };
    expect(data.error).toBe('Invalid query parameters');
    expect(data.issues[0]!.field).toBe('page');
  });

  it('path schema built with zod v3 produces field-specific issues', async () => {
    const pathParamSchema = zv3.object({ id: zv3.coerce.number() });
    await adapter.registerRoute(
      app,
      {
        method: 'POST',
        path: '/v1/p/:id',
        responseType: 'json',
        pathParamSchema,
        handler: async () => ({ ok: true }),
      } as any,
      { prefix: '' },
    );
    await app.ready();

    const response = await app.inject({
      method: 'POST',
      url: '/v1/p/not-a-number',
      headers: { 'content-type': 'application/json' },
      payload: {},
    });

    expect(response.statusCode).toBe(400);
    const data = response.json() as { error: string; issues: Array<{ field: string; message: string }> };
    expect(data.error).toBe('Invalid path parameters');
    expect(data.issues[0]!.field).toBe('id');
  });
});
