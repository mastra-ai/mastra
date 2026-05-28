/**
 * Regression coverage for https://github.com/mastra-ai/mastra/issues/17167
 * applied to the Express adapter.
 *
 * When a consumer pins `zod@^3`, route schemas are constructed with v3 `z`
 * and `parseAsync` throws a v3 `ZodError`. The Express adapter previously
 * checked `error instanceof ZodError` against the v4 class bundled with this
 * package, so the catch fell through to a generic response that dropped the
 * field path. The fix uses a structural ZodError check; these tests prove it.
 */
import type { Server } from 'node:http';
import type { AdapterTestContext } from '@internal/server-adapter-test-utils';
import { createDefaultTestContext } from '@internal/server-adapter-test-utils';
import express from 'express';
import type { Application } from 'express';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z as zv3 } from 'zod/v3';
import { MastraServer } from '../index';

describe('Express adapter: zod v3 validation errors preserve field path (issue #17167)', () => {
  let context: AdapterTestContext;
  let app: Application;
  let adapter: MastraServer;
  let server: Server;
  let baseUrl: string;

  beforeEach(async () => {
    context = await createDefaultTestContext();
    app = express();
    app.use(express.json());
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
    });

    expect(response.status).toBe(400);
    const data = (await response.json()) as { error: string; issues: Array<{ field: string; message: string }> };
    expect(data.error).toBe('Invalid path parameters');
    expect(data.issues[0]!.field).toBe('id');
  });
});
