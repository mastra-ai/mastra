import type { Server } from 'node:http';
import type { ServerRoute } from '@mastra/server/server-adapter';
import { createDefaultTestContext } from '@mastra/server-adapters-test-suite';
import Koa from 'koa';
import bodyParser from 'koa-bodyparser';
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
    holdUntilDisconnect = false,
  }: {
    responseType: 'datastream-response' | 'stream';
    holdUntilDisconnect?: boolean;
  }) {
    const context = await createDefaultTestContext();
    const app = new Koa();
    app.use(bodyParser());
    const adapter = new MastraServer({ app, mastra: context.mastra });

    const state = { pulls: 0 };
    const canceled = vi.fn();
    let handlerEntered!: () => void;
    const handlerStarted = new Promise<void>(resolve => (handlerEntered = resolve));
    let handlerReturned!: () => void;
    const handlerDone = new Promise<void>(resolve => (handlerReturned = resolve));
    let serverSawClose!: () => void;
    const disconnected = new Promise<void>(resolve => (serverSawClose = resolve));

    const route: ServerRoute<any, any, any> = {
      method: 'POST',
      path: '/test/disconnect',
      responseType,
      handler: async () => {
        handlerEntered();
        if (holdUntilDisconnect) await disconnected;
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
    app.use(async (ctx, next) => {
      ctx.res.on('close', serverSawClose);
      await next();
    });
    app.use(adapter.createContextMiddleware());
    await adapter.registerRoute(app, route, { prefix: '' });

    server = await new Promise<Server>(resolve => {
      const s = app.listen(0, () => resolve(s));
    });
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;

    return { url: `http://localhost:${port}/test/disconnect`, state, canceled, handlerStarted, handlerDone };
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
      const { url, state, canceled, handlerStarted, handlerDone } = await setup({
        responseType,
        holdUntilDisconnect: true,
      });

      const client = new AbortController();
      const request = fetch(url, { method: 'POST', signal: client.signal }).catch(() => undefined);
      await handlerStarted;
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
