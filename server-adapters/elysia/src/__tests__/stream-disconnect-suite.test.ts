import { createServer } from 'node:net';
import { node } from '@elysiajs/node';
import { Mastra } from '@mastra/core/mastra';
import { createStreamDisconnectTestSuite } from '@mastra/server-adapters-test-suite';
import { Elysia } from 'elysia';
import { MastraServer } from '../index';

// @elysiajs/node reports port 0 back instead of the bound port, so pick a free port up front.
async function getFreePort(): Promise<number> {
  const probe = createServer();
  await new Promise<void>(resolve => probe.listen(0, '127.0.0.1', () => resolve()));
  const address = probe.address();
  await new Promise(resolve => probe.close(resolve));
  return typeof address === 'object' && address ? address.port : 0;
}

// Served through Elysia's official Node adapter over a real socket.
createStreamDisconnectTestSuite({
  startServer: async (route, { beforeContext } = {}) => {
    const app = new Elysia({ adapter: node() });
    if (beforeContext) {
      app.onRequest(beforeContext);
    }

    const adapter = new MastraServer({ app, mastra: new Mastra({ logger: false }) });
    adapter.registerContextMiddleware();
    await adapter.registerRoute(app, route, { prefix: '' });
    const port = await getFreePort();
    let stop!: () => unknown;
    await new Promise<void>(resolve =>
      app.listen({ port, hostname: '127.0.0.1' }, server => {
        stop = () => server.stop(true);
        resolve();
      }),
    );
    return {
      url: `http://127.0.0.1:${port}${route.path}`,
      close: async () => {
        await stop();
      },
    };
  },
});
