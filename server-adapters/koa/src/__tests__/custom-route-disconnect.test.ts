import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createCustomRouteDisconnectTestSuite } from '@mastra/server-adapters-test-suite';
import Koa from 'koa';
import bodyParser from 'koa-bodyparser';

import { MastraServer } from '../index';

createCustomRouteDisconnectTestSuite({
  suiteName: 'Koa custom route client disconnect',
  startServer: async mastra => {
    const app = new Koa();
    app.use(bodyParser());
    await new MastraServer({ app, mastra }).init();
    const server: Server = await new Promise(resolve => {
      const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });
    const { port } = server.address() as AddressInfo;
    return {
      baseUrl: `http://127.0.0.1:${port}`,
      close: async () => {
        server.closeAllConnections();
        await new Promise<void>(resolve => server.close(() => resolve()));
      },
    };
  },
});
