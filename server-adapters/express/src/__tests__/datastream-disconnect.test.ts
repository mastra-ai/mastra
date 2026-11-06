import type { Server } from 'node:http';
import type { ServerRoute } from '@mastra/server/server-adapter';
import { createDefaultTestContext } from '@mastra/server-adapters-test-suite';
import express from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MastraServer } from '../index';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

describe('streaming client disconnect', () => {
  let server: Server | undefined;

  afterEach(async () => {
    server?.closeAllConnections();
    await new Promise<void>(resolve => (server ? server.close(() => resolve()) : resolve()));
    server = undefined;
  });

  async function setup({
    responseType,
    handlerDelayMs = 0,
  }: {
    responseType: 'datastream-response' | 'stream';
    handlerDelayMs?: number;
  }) {
    const context = await createDefaultTestContext();
    const app = express();
    const adapter = new MastraServer({ app, mastra: context.mastra });

    const state = { pulls: 0 };
    const canceled = vi.fn();
    let handlerReturned!: () => void;
    const handlerDone = new Promise<void>(resolve => (handlerReturned = resolve));

    const route: ServerRoute<any, any, any> = {
      method: 'POST',
      path: '/test/disconnect',
      responseType,
      handler: async () => {
        await sleep(handlerDelayMs);
        handlerReturned();
        const body = new ReadableStream({
          async pull(controller) {
            state.pulls++;
            await sleep(10);
            controller.enqueue(
              responseType === 'stream'
                ? { type: 'chunk', n: state.pulls }
                : new TextEncoder().encode(`chunk-${state.pulls}\n`),
            );
          },
          cancel: canceled,
        });

        return responseType === 'stream'
          ? body
          : new Response(body, { status: 200, headers: { 'Content-Type': 'text/plain' } });
      },
    };
    app.use(adapter.createContextMiddleware());
    await adapter.registerRoute(app, route, { prefix: '' });

    server = await new Promise<Server>(resolve => {
      const s = app.listen(0, () => resolve(s));
    });
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;

    return { url: `http://localhost:${port}/test/disconnect`, state, canceled, handlerDone };
  }

  it('cancels a datastream-response body and stops pulling when the client aborts mid-body', async () => {
    const { url, state, canceled } = await setup({ responseType: 'datastream-response' });

    const client = new AbortController();
    const response = await fetch(url, { method: 'POST', signal: client.signal });
    await response.body!.getReader().read();
    const pullsAtAbort = state.pulls;
    client.abort();

    await sleep(300);
    expect(state.pulls - pullsAtAbort, 'upstream pulls after client abort').toBeLessThanOrEqual(2);
    expect(canceled).toHaveBeenCalledWith('request aborted');
  });

  it.each(['datastream-response', 'stream'] as const)(
    'cancels a %s body when the client aborts before the handler returns',
    async responseType => {
      const { url, state, canceled, handlerDone } = await setup({ responseType, handlerDelayMs: 200 });

      const client = new AbortController();
      const request = fetch(url, { method: 'POST', signal: client.signal }).catch(() => undefined);
      await sleep(50);
      expect(state.pulls).toBe(0);
      client.abort();
      await request;

      await handlerDone;
      await sleep(300);
      expect(state.pulls, 'upstream pulls after client abort').toBeLessThanOrEqual(2);
      expect(canceled).toHaveBeenCalledWith('request aborted');
    },
  );
});
