import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LibSQLStore } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import { createBuiltinMCPToolsetsTestSuite } from '@mastra/server-adapters-test-suite';
import { Elysia } from 'elysia';

import { MastraServer } from '../index';
import { startElysiaServer } from './helpers';

createBuiltinMCPToolsetsTestSuite({
  suiteName: 'Elysia built-in MCP memory and observability toolsets',
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
    const app = new Elysia();
    await new MastraServer({ app, mastra }).init();
    const { baseUrl, cleanup } = await startElysiaServer(app);
    return { url: baseUrl, close: cleanup };
  },
});
