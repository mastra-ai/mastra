import { mkdtemp, rm } from 'node:fs/promises';
import type { Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LibSQLStore } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import { createBuiltinMCPToolsetsTestSuite } from '@mastra/server-adapters-test-suite';
import { Test } from '@nestjs/testing';
import express from 'express';
import type { Application } from 'express';

import { MastraModule } from '../index';

createBuiltinMCPToolsetsTestSuite({
  suiteName: 'NestJS built-in MCP memory and observability toolsets',
  createStorage: async () => {
    const dir = await mkdtemp(join(tmpdir(), 'mcp-toolsets-'));
    return {
      storage: new LibSQLStore({ id: 'mcp-toolsets', url: `file:${join(dir, 'mastra.db')}` }),
      cleanup: () => rm(dir, { recursive: true, force: true }),
    };
  },
  createMemory: (storage, scope, observationalMemory) =>
    new Memory({
      storage,
      options: { observationalMemory: { model: 'openai/gpt-4o', scope, ...observationalMemory } },
    }),
  startServer: async mastra => {
    const moduleRef = await Test.createTestingModule({
      // The suite makes many MCP calls in a few seconds; the default rate limit would throttle them.
      imports: [MastraModule.register({ mastra, rateLimitOptions: { enabled: false } })],
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
