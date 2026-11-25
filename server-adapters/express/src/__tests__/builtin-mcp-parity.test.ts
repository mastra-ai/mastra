import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createBuiltinMCPParityTestSuite } from '@mastra/server-adapters-test-suite';
import express from 'express';

import { MastraServer } from '../index';

createBuiltinMCPParityTestSuite({
  suiteName: 'Express built-in MCP server',
  startServer: async mastra => {
    const app = express();
    app.use(express.json());
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
