import { mkdtemp, rm } from 'node:fs/promises';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LibSQLStore } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import { createBuiltinMCPToolsetsTestSuite } from '@mastra/server-adapters-test-suite';
import Koa from 'koa';
import bodyParser from 'koa-bodyparser';

import { MastraServer } from '../index';

createBuiltinMCPToolsetsTestSuite({
  suiteName: 'Koa built-in MCP memory and observability toolsets',
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
