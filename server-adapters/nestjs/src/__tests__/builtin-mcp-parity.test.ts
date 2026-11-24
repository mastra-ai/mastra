import type { Server } from 'node:http';
import { createBuiltinMCPParityTestSuite } from '@mastra/server-adapters-test-suite';
import { Test } from '@nestjs/testing';
import express from 'express';
import type { Application } from 'express';

import { MastraModule } from '../index';

createBuiltinMCPParityTestSuite({
  suiteName: 'NestJS built-in MCP server',
  // NestJS reads `?apiKey=` only when allowQueryApiKey is on; turn it on to prove the MCP route still ignores it.
  startServer: async mastra => {
    const moduleRef = await Test.createTestingModule({
      imports: [MastraModule.register({ mastra, auth: { allowQueryApiKey: true } })],
    }).compile();
    const nestApp = moduleRef.createNestApplication();
    const expressApp = nestApp.getHttpAdapter().getInstance() as Application;
    expressApp.use(express.json());
    await nestApp.init();
    const server: Server = await new Promise(resolve => {
      const s = expressApp.listen(0, () => resolve(s));
    });
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Failed to get server address');
    return {
      url: `http://localhost:${address.port}`,
      close: async () => {
        // Drop idle client sockets on close (an aborted MCP call can leave one behind).
        server.closeAllConnections();
        await new Promise<void>(resolve => server.close(() => resolve()));
        await nestApp.close();
      },
    };
  },
});
