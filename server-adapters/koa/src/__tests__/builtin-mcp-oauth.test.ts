import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createBuiltinMCPOAuthTestSuite } from '@mastra/server-adapters-test-suite';
import Koa from 'koa';
import bodyParser from 'koa-bodyparser';

import { MastraServer } from '../index';

createBuiltinMCPOAuthTestSuite({
  suiteName: 'Koa built-in MCP OAuth',
  startServer: async mastra => {
    const app = new Koa();
    app.use(bodyParser());
    await new MastraServer({ app, mastra }).init();
    const server: Server = await new Promise(resolve => {
      const s = app.listen(0, () => resolve(s));
    });
    const { port } = server.address() as AddressInfo;
    return {
      url: `http://localhost:${port}`,
      close: () => new Promise<void>(resolve => server.close(() => resolve())),
    };
  },
});
