import type { ServerRoute } from '@mastra/server/server-adapter';
import { createDefaultTestContext } from '@mastra/server-adapters-test-suite';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MastraServer } from '../index';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

describe('streaming client disconnect', () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  async function setup({
    responseType,
    holdUntilDisconnect = false,
  }: {
    responseType: 'datastream-response' | 'stream';
    holdUntilDisconnect?: boolean;
  }) {
    const context = await createDefaultTestContext();
    app = Fastify({ forceCloseConnections: true });
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
    app.addHook('onRequest', async (_request, reply) => {
      reply.raw.on('close', serverSawClose);
    });
    app.addHook('preHandler', adapter.createContextMiddleware());
    await adapter.registerRoute(app, route, { prefix: '' });

    const address = await app.listen({ port: 0 });

    return { url: `${address}/test/disconnect`, state, canceled, handlerStarted, handlerDone };
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
