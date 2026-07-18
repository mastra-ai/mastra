/**
 * Regression tests for custom-route execution-context passthrough.
 *
 * Issue: https://github.com/mastra-ai/mastra/issues/19285
 *
 * Custom API routes (which include channel webhooks) are dispatched through an
 * internal Hono sub-app in `handleCustomRouteRequest`. On Cloudflare Workers the
 * platform `waitUntil` lives on the request's `executionCtx`; if that hop drops
 * it, background work started in a route handler (e.g. an agent streaming its
 * reply) is killed once the response returns. These tests assert the context is
 * forwarded, and that the Node path (no execution context) still works.
 */
import { Mastra } from '@mastra/core/mastra';
import type { ExecutionContext } from 'hono';
import { Hono } from 'hono';
import { describe, it, expect, vi } from 'vitest';
import { MastraServer } from '../index';

describe('MastraServer (Hono) - custom route execution context passthrough', () => {
  function buildProbeAdapter() {
    let seenWaitUntil: ExecutionContext['waitUntil'] | undefined;
    let handlerRan = false;

    const mastra = new Mastra({
      logger: false,
      server: {
        apiRoutes: [
          {
            path: '/probe-execution-ctx',
            method: 'POST',
            requiresAuth: false,
            handler: async c => {
              handlerRan = true;
              // Hono's `executionCtx` getter throws when none exists (Node), so guard it.
              try {
                seenWaitUntil = c.executionCtx?.waitUntil;
              } catch {
                seenWaitUntil = undefined;
              }
              return c.json({ ok: true });
            },
          },
        ],
      },
    });

    const app = new Hono();
    const adapter = new MastraServer({ app, mastra });

    return { app, adapter, read: () => ({ seenWaitUntil, handlerRan }) };
  }

  it('forwards the executionCtx passed to app.fetch() into custom route handlers', async () => {
    const { app, adapter, read } = buildProbeAdapter();
    await adapter.init();

    const fakeExecutionCtx = {
      waitUntil: vi.fn(),
      passThroughOnException: vi.fn(),
      props: {},
    } satisfies ExecutionContext;

    // Mirrors a Cloudflare Worker entry: `fetch: (request, env, ctx) => app.fetch(request, env, ctx)`.
    const response = await app.fetch(
      new Request('http://localhost/probe-execution-ctx', { method: 'POST' }),
      {},
      fakeExecutionCtx,
    );

    // The execution context handed to the top-level app.fetch() must be the same
    // one visible inside the custom route handler, so background work can be
    // registered via `ctx.waitUntil` and survive past the response. It is dropped
    // if `handleCustomRouteRequest` -> the internal sub-app hop fails to forward it.
    expect(response.status).toBe(200);
    expect(read().seenWaitUntil).toBe(fakeExecutionCtx.waitUntil);
  });

  it('does not throw when no execution context is provided (Node runtimes)', async () => {
    const { app, adapter, read } = buildProbeAdapter();
    await adapter.init();

    // No third arg — the platform provides no ExecutionContext (e.g. Node).
    const response = await app.fetch(new Request('http://localhost/probe-execution-ctx', { method: 'POST' }));

    const { handlerRan, seenWaitUntil } = read();
    expect(handlerRan).toBe(true);
    expect(response.status).toBe(200);
    expect(seenWaitUntil).toBeUndefined();
  });
});
