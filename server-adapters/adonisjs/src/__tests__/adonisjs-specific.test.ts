import { AppFactory } from '@adonisjs/core/factories/app';
import { LLMock } from '@copilotkit/aimock';
import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { registerApiRoute } from '@mastra/core/server';
import { createTool } from '@mastra/core/tools';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { getHttpContext, MastraServer } from '../index';
import { createAdonisRouter, listen } from './helpers';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

describe('AdonisJS lifecycle', () => {
  it('serves Mastra routes registered by init() once the router is committed, and shuts Mastra down on terminate', async () => {
    const app = new AppFactory().create(new URL('./', import.meta.url));
    await app.init();
    await app.boot();

    const mastra = new Mastra({ logger: false });
    const shutdown = vi.spyOn(mastra, 'shutdown');
    const router = await createAdonisRouter();
    await new MastraServer({ app: router, mastra }).init();
    // Documented wiring for start/routes.ts
    app.terminating(() => mastra.shutdown());

    const server = await listen(router);
    try {
      const res = await fetch(`${server.url}/api/agents`);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({});
      expect((await fetch(`${server.url}/api/agents`, { method: 'HEAD' })).status).toBe(200);
    } finally {
      await server.close();
    }

    await app.terminate();
    expect(shutdown).toHaveBeenCalledTimes(1);
  });

  it('logs the base warning when Hono-style server middleware is configured', async () => {
    const mastra = new Mastra({ logger: false, server: { middleware: [async (_c: any, next: any) => next()] } });
    const warn = vi.spyOn(mastra.getLogger(), 'warn');
    await new MastraServer({ app: await createAdonisRouter(), mastra }).init();
    expect(warn.mock.calls.some(([message]) => String(message).includes('middleware'))).toBe(true);
  });

  it.each([true, false])('forwards multipart uploads to custom API routes (bodyParser: %s)', async bodyParser => {
    const mastra = new Mastra({
      logger: false,
      server: {
        apiRoutes: [
          registerApiRoute('/upload', {
            method: 'POST',
            requiresAuth: false,
            handler: async c => {
              const form = await c.req.formData();
              const file = form.get('file') as File;
              return c.json({ note: form.get('note'), name: file.name, text: await file.text() });
            },
          }),
        ],
      },
    });
    const router = await createAdonisRouter({ bodyParser });
    await new MastraServer({ app: router, mastra }).init();
    const server = await listen(router);
    try {
      const form = new FormData();
      form.append('note', 'hi');
      form.append('file', new Blob(['file-bytes']), 'a.txt');
      const res = await fetch(`${server.url}/upload`, { method: 'POST', body: form });
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ note: 'hi', name: 'a.txt', text: 'file-bytes' });
    } finally {
      await server.close();
    }
  });

  it('exposes the AdonisJS HttpContext to Mastra code and runs routeMiddleware on Mastra routes', async () => {
    const mastra = new Mastra({
      logger: false,
      server: {
        apiRoutes: [
          registerApiRoute('/whoami', {
            method: 'GET',
            requiresAuth: false,
            handler: async c => {
              const ctx = getHttpContext(c.get('requestContext'));
              return c.json({ tenant: (ctx as any)?.tenant ?? null, url: ctx?.request.url() ?? null });
            },
          }),
        ],
      },
    });
    const router = await createAdonisRouter();
    const seen: string[] = [];
    await new MastraServer({
      app: router,
      mastra,
      routeMiddleware: async (ctx, next) => {
        (ctx as any).tenant = 'acme';
        seen.push(ctx.request.url());
        return next();
      },
    }).init();

    const server = await listen(router);
    try {
      const res = await fetch(`${server.url}/whoami`);
      expect(await res.json()).toEqual({ tenant: 'acme', url: '/whoami' });
      expect((await fetch(`${server.url}/api/agents`)).status).toBe(200);
      expect(seen).toEqual(['/whoami', '/api/agents']);
    } finally {
      await server.close();
    }
  });
});

describe('AdonisJS stream client disconnect', () => {
  let llm: LLMock;
  let close: () => Promise<void>;
  let url: string;
  const toolState = { calls: 0, abortSignalsFired: 0 };

  beforeEach(async () => {
    toolState.calls = 0;
    toolState.abortSignalsFired = 0;

    llm = new LLMock({ port: 0 });
    await llm.start();
    // Every turn answers with another tool call, so the agent loops until it is aborted or hits maxSteps.
    llm.on({ userMessage: 'loop' }, { toolCalls: [{ name: 'tick', arguments: '{}' }] });

    const tick = createTool({
      id: 'tick',
      description: 'tick',
      inputSchema: z.object({}),
      execute: async (_input, context) => {
        toolState.calls++;
        context?.abortSignal?.addEventListener('abort', () => toolState.abortSignalsFired++, { once: true });
        await sleep(100);
        return 'ticked';
      },
    });

    const agent = new Agent({
      id: 'looper',
      name: 'looper',
      instructions: 'Call tick.',
      model: { id: 'openai/gpt-4o-mini', url: `${llm.url.replace(/\/+$/, '')}/v1`, apiKey: 'test-key' },
      tools: { tick },
    });

    const router = await createAdonisRouter();
    await new MastraServer({ app: router, mastra: new Mastra({ agents: { looper: agent }, logger: false }) }).init();
    ({ url, close } = await listen(router));
  });

  afterEach(async () => {
    await close();
    await llm.stop();
  });

  it('aborts the agent run when the client disconnects mid-stream', async () => {
    const controller = new AbortController();
    const res = await fetch(`${url}/api/agents/looper/stream`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ messages: 'loop', maxSteps: 50 }),
      signal: controller.signal,
    });
    expect(res.status).toBe(200);

    const reader = res.body!.getReader();
    while (toolState.calls < 2) {
      const { done } = await reader.read();
      if (done) throw new Error('stream ended before the agent looped');
    }
    controller.abort();
    const modelCallsAtAbort = llm.getRequests().length;

    await sleep(1500);

    expect(toolState.abortSignalsFired).toBeGreaterThan(0);
    // At most the in-flight step finishes; the loop must not keep calling the model.
    expect(llm.getRequests().length - modelCallsAtAbort).toBeLessThanOrEqual(1);
  });
});
