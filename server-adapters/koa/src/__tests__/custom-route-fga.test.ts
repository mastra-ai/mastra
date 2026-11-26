import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createCustomRouteFGATestSuite } from '@mastra/server-adapters-test-suite';
import Koa from 'koa';
import bodyParser from 'koa-bodyparser';

import { MastraServer } from '../index';

createCustomRouteFGATestSuite({
  suiteName: 'Koa custom route FGA',
  startServer: async mastra => {
    const app = new Koa();
    app.use(bodyParser());
    await new MastraServer({ app, mastra }).init();
    const server: Server = await new Promise(resolve => {
      const s = app.listen(0, () => resolve(s));
    });
    const { port } = server.address() as AddressInfo;
    return {
      request: (path, init) => fetch(`http://localhost:${port}${path}`, init),
      close: () => new Promise<void>(resolve => server.close(() => resolve())),
    };
  },
});
