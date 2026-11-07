import type { AddressInfo } from 'node:net';
import { serve } from '@hono/node-server';
import { createObservabilitySignalWriteTestSuite } from '@mastra/server-adapters-test-suite';
import { Hono } from 'hono';
import { MastraServer } from '../index';

createObservabilitySignalWriteTestSuite({
  startServer: async mastra => {
    const app = new Hono();
    await new MastraServer({ app, mastra }).init();
    const server = serve({ fetch: app.fetch, port: 0 });
    if (!server.listening) await new Promise<void>(resolve => server.once('listening', resolve));
    const { port } = server.address() as AddressInfo;
    return {
      request: (path, init) => fetch(`http://localhost:${port}${path}`, init),
      close: () => new Promise<void>(resolve => server.close(() => resolve())),
    };
  },
});
