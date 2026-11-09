import type { Server } from 'node:http';
import { Mastra } from '@mastra/core/mastra';
import type { ServerRoute } from '@mastra/server/server-adapter';
import { createStreamDisconnectTestSuite } from '@mastra/server-adapters-test-suite';
import Koa from 'koa';
import type { Context } from 'koa';
import bodyParser from 'koa-bodyparser';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MastraServer } from '../index';

async function listen(app: Koa) {
  const server: Server = await new Promise(resolve => {
    const started = app.listen(0, '127.0.0.1', () => resolve(started));
  });
  const address = server.address();

  if (!address || typeof address === 'string') {
    throw new Error('Expected TCP listener');
  }

  return {
    port: address.port,
    close: async () => {
      server.closeAllConnections();
      await new Promise<void>(resolve => server.close(() => resolve()));
    },
  };
}

createStreamDisconnectTestSuite({
  startServer: async (route, { beforeContext } = {}) => {
    const app = new Koa();
    app.use(bodyParser());
    const adapter = new MastraServer({ app, mastra: new Mastra({ logger: false }) });
    if (beforeContext) {
      app.use(async (_ctx, next) => {
        await beforeContext();
        await next();
      });
    }
    app.use(adapter.createContextMiddleware());
    await adapter.registerRoute(app, route, { prefix: '' });
    const { port, close } = await listen(app);
    return { url: `http://127.0.0.1:${port}${route.path}`, close };
  },
});

// A client that leaves while a write is still waiting on a full socket makes the write fail with EPIPE or
// ECONNRESET, depending on the OS. Destroying the socket with that error reaches Koa the same way.
describe.each(['stream', 'datastream-response'] as const)(
  'Koa %s route socket errors after a disconnect',
  responseType => {
    let close: (() => Promise<void>) | undefined;

    afterEach(async () => {
      vi.restoreAllMocks();
      await close?.();
      close = undefined;
    });

    it.each(['EPIPE', 'ECONNRESET'])('does not print %s as a server error', async code => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      let ctx!: Context;
      let canceled = false;
      const app = new Koa();
      app.use(async (context, next) => {
        ctx = context;
        await next();
      });
      const adapter = new MastraServer({ app, mastra: new Mastra({ logger: false }) });
      app.use(adapter.createContextMiddleware());
      const route: ServerRoute<any, any, any> = {
        method: 'GET',
        path: '/test/socket-error',
        responseType,
        handler: async () => {
          let pulls = 0;
          const body = new ReadableStream({
            async pull(controller) {
              pulls++;
              await new Promise(resolve => setTimeout(resolve, 10));
              controller.enqueue(
                responseType === 'stream' ? { type: 'chunk', n: pulls } : new TextEncoder().encode(`chunk-${pulls}\n`),
              );
            },
            cancel() {
              canceled = true;
            },
          });
          return responseType === 'stream' ? body : new Response(body, { headers: { 'Content-Type': 'text/plain' } });
        },
      };
      await adapter.registerRoute(app, route, { prefix: '' });
      const server = await listen(app);
      close = server.close;

      const response = await fetch(`http://127.0.0.1:${server.port}${route.path}`);
      await response.body!.getReader().read();
      ctx.res.socket!.destroy(Object.assign(new Error(`write ${code}`), { code, syscall: 'write' }));

      await vi.waitFor(() => expect(canceled, 'upstream cancel()').toBe(true));
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(consoleError).not.toHaveBeenCalled();
    });
  },
);
