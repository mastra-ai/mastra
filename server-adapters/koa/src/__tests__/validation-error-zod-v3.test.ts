/**
 * Regression coverage for https://github.com/mastra-ai/mastra/issues/17167
 * applied to the Koa adapter. Same diagnosis as Hono/Express/Fastify: a
 * consumer pinned to `zod@^3` builds schemas whose `ZodError` is not
 * `instanceof` the v4 `ZodError` bundled with this adapter. The structural
 * `isZodError` check restores the correct field-path response shape.
 */
import type { Server } from 'node:http';
import type { AdapterTestContext } from '@internal/server-adapter-test-utils';
import { createDefaultTestContext } from '@internal/server-adapter-test-utils';
import Koa from 'koa';
import bodyParser from 'koa-bodyparser';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z as zv3 } from 'zod/v3';
import { MastraServer } from '../index';

describe('Koa adapter: zod v3 validation errors preserve field path (issue #17167)', () => {
  let context: AdapterTestContext;
  let app: Koa;
  let adapter: MastraServer;
  let server: Server;
  let baseUrl: string;

  beforeEach(async () => {
    context = await createDefaultTestContext();
    app = new Koa();
    app.use(bodyParser());
    adapter = new MastraServer({
      app,
      mastra: context.mastra,
      taskStore: context.taskStore,
    });
    app.use(adapter.createContextMiddleware());
  });

  afterEach(async () => {
    if (server) {
      await new Promise<void>(resolve => server.close(() => resolve()));
    }
  });

  async function listen(): Promise<void> {
    server = await new Promise<Server>(resolve => {
      const s = app.listen(0, () => resolve(s));
    });
    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Failed to get server address');
    }
    baseUrl = `http://localhost:${address.port}`;
  }

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
    await listen();

    const response = await fetch(`${baseUrl}/v1/conversations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(response.status).toBe(400);
    const data = (await response.json()) as { error: string; issues: Array<{ field: string; message: string }> };
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
    await listen();

    const response = await fetch(`${baseUrl}/v1/q?page=not-a-number`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(response.status).toBe(400);
    const data = (await response.json()) as { error: string; issues: Array<{ field: string; message: string }> };
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
    await listen();

    const response = await fetch(`${baseUrl}/v1/p/not-a-number`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(response.status).toBe(400);
    const data = (await response.json()) as { error: string; issues: Array<{ field: string; message: string }> };
    expect(data.error).toBe('Invalid path parameters');
    expect(data.issues[0]!.field).toBe('id');
  });
});
