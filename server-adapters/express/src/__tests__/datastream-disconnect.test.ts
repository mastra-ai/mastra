import type { Server } from 'node:http';
import type { ServerRoute } from '@mastra/server/server-adapter';
import { createDefaultTestContext } from '@mastra/server-adapters-test-suite';
import express from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MastraServer } from '../index';

describe('datastream-response client disconnect', () => {
  let server: Server | undefined;

  afterEach(async () => {
    server?.closeAllConnections();
    await new Promise<void>(resolve => (server ? server.close(() => resolve()) : resolve()));
    server = undefined;
  });

  it('cancels the upstream body and stops pulling when the client aborts mid-body', async () => {
    const context = await createDefaultTestContext();
    const app = express();
    const adapter = new MastraServer({ app, mastra: context.mastra });

    let pulls = 0;
    const canceled = vi.fn();
    const body = new ReadableStream<Uint8Array>({
      async pull(controller) {
        pulls++;
        await new Promise(resolve => setTimeout(resolve, 10));
        controller.enqueue(new TextEncoder().encode(`chunk-${pulls}\n`));
      },
      cancel: canceled,
    });

    const route: ServerRoute<any, any, any> = {
      method: 'POST',
      path: '/test/datastream-disconnect',
      responseType: 'datastream-response',
      handler: async () => new Response(body, { status: 200, headers: { 'Content-Type': 'text/plain' } }),
    };
    app.use(adapter.createContextMiddleware());
    await adapter.registerRoute(app, route, { prefix: '' });

    server = await new Promise<Server>(resolve => {
      const s = app.listen(0, () => resolve(s));
    });
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;

    const client = new AbortController();
    const response = await fetch(`http://localhost:${port}/test/datastream-disconnect`, {
      method: 'POST',
      signal: client.signal,
    });
    const clientReader = response.body!.getReader();
    await clientReader.read();
    const pullsAtAbort = pulls;
    client.abort();

    await new Promise(resolve => setTimeout(resolve, 300));
    expect(pulls - pullsAtAbort, 'upstream pulls after client abort').toBeLessThanOrEqual(2);
    expect(canceled).toHaveBeenCalledWith('request aborted');
  });
});
