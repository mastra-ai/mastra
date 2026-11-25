import { appendFileSync } from 'node:fs';
import { Mastra } from '@mastra/core/mastra';
import { createTool } from '@mastra/core/tools';
import { LibSQLStore } from '@mastra/libsql';
import { z } from 'zod';
import { RedisStreamsPubSub } from '../src/index.ts';

// A server whose background tool kills its own process on every attempt.
const crash = createTool({
  id: 'crash',
  description: 'Kills the worker that runs it',
  inputSchema: z.object({}),
  background: { enabled: true, maxRetries: 1 },
  execute: async () => {
    appendFileSync(process.env.ATTEMPTS_FILE!, `${process.pid}\n`);
    process.kill(process.pid, 'SIGKILL');
    return {};
  },
});

const mastra = new Mastra({
  logger: false,
  tools: { crash },
  storage: new LibSQLStore({ id: 'crash-loop', url: process.env.STORAGE_URL! }),
  pubsub: new RedisStreamsPubSub({ url: process.env.REDIS_URL, keyPrefix: process.env.KEY_PREFIX }),
  backgroundTasks: { enabled: true, leaseDurationMs: 3000 },
});
await mastra.startWorkers();

if (process.env.ENQUEUE) {
  await mastra.backgroundTaskManager!.enqueue({
    toolName: 'crash',
    toolCallId: 'call-1',
    args: {},
    agentId: 'agent',
    runId: 'run-1',
    maxRetries: 1,
  });
}
console.info('server-ready');
