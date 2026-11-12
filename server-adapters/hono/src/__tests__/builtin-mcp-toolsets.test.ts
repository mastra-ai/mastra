import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { serve } from '@hono/node-server';
import { LibSQLStore } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import { createBuiltinMCPToolsetsTestSuite } from '@mastra/server-adapters-test-suite';
import { Hono } from 'hono';

import { MastraServer } from '../index';

createBuiltinMCPToolsetsTestSuite({
  suiteName: 'Hono built-in MCP memory and observability toolsets',
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
    const app = new Hono();
    await new MastraServer({ app, mastra }).init();
    const server = serve({ fetch: app.fetch, port: 0 });
    await new Promise(resolve => server.once('listening', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Failed to get server address');
    return {
      url: `http://localhost:${address.port}`,
      close: () => new Promise<void>(resolve => server.close(() => resolve())),
    };
  },
});
