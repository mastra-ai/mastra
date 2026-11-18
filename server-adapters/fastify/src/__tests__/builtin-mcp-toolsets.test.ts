import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LibSQLStore } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import { createBuiltinMCPToolsetsTestSuite } from '@mastra/server-adapters-test-suite';
import Fastify from 'fastify';

import { MastraServer } from '../index';

createBuiltinMCPToolsetsTestSuite({
  suiteName: 'Fastify built-in MCP memory and observability toolsets',
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
    // Drop idle client sockets on close (an aborted MCP call can leave one behind).
    const app = Fastify({ logger: false, forceCloseConnections: true });
    await new MastraServer({ app, mastra }).init();
    const address = await app.listen({ port: 0, host: '127.0.0.1' });
    return { url: address.replace('127.0.0.1', 'localhost'), close: () => app.close() };
  },
});
