/**
 * One process of a split deploy for the observe-index restart test (COR-1506):
 * ROLE=api serves HTTP from `createNodeServer` with MASTRA_WORKERS=false, and
 * ROLE=worker runs the agentic loop with MASTRA_WORKERS=orchestration. Both
 * share a LibSQL file, RedisStreamsPubSub and a Redis server cache, so an API
 * restarted mid-run reads the same numbered run log.
 *
 * The `wait_gate` tool blocks until the test sets `${KEY_PREFIX}:gate` in
 * Redis, so the run is still live when the API restarts. Logs `ready` once up
 * and `gate-entered` when the tool starts.
 */
import { createOpenAI } from '@ai-sdk/openai-v5';
import { Agent } from '@mastra/core/agent';
import { createDurableAgent, createEventedAgent } from '@mastra/core/agent/durable';
import { Mastra } from '@mastra/core/mastra';
import { createTool } from '@mastra/core/tools';
import { createNodeServer } from '@mastra/deployer/server';
import { LibSQLStore } from '@mastra/libsql';
import { createClient } from 'redis';
import { z } from 'zod';

import { nodeRedisPreset, RedisServerCache } from '../../../stores/redis/src/cache';
import { RedisStreamsPubSub } from '../src/index';

const { ROLE, REDIS_URL, KEY_PREFIX, STORAGE_URL, LLM_URL, ENGINE = 'durable', PORT } = process.env;

const cacheClient = createClient({ url: REDIS_URL });
await cacheClient.connect();

const lookup = createTool({
  id: 'lookup',
  description: 'Look up a number.',
  inputSchema: z.object({ n: z.number() }),
  execute: async ({ n }) => ({ value: n * 10 }),
});

const waitGate = createTool({
  id: 'wait_gate',
  description: 'Waits until the operator releases it.',
  inputSchema: z.object({}),
  execute: async () => {
    console.info('gate-entered');
    while (!(await cacheClient.get(`${KEY_PREFIX}:gate`))) await new Promise(r => setTimeout(r, 50));
    return { released: true };
  },
});

const openai = createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${LLM_URL}/v1` });
const base = new Agent({
  id: 'agent',
  name: 'Restart Agent',
  instructions: 'You are a test agent driven by scripted AIMock responses.',
  model: openai('gpt-4o-mini'),
  tools: { lookup, wait_gate: waitGate },
});
const agent = ENGINE === 'evented' ? createEventedAgent({ agent: base }) : createDurableAgent({ agent: base });

const mastra = new Mastra({
  logger: false,
  storage: new LibSQLStore({ id: 'observe-index-restart', url: STORAGE_URL! }),
  pubsub: new RedisStreamsPubSub({ url: REDIS_URL, keyPrefix: KEY_PREFIX, blockMs: 100 }),
  cache: new RedisServerCache(
    { client: cacheClient as any },
    { ...nodeRedisPreset, keyPrefix: `${KEY_PREFIX}:cache:` },
  ),
  agents: { agent },
  ...(ROLE === 'api' ? { server: { port: Number(PORT) } } : {}),
});

if (ROLE === 'worker') await mastra.startWorkers();
else await createNodeServer(mastra, { tools: {}, studio: false, isDev: false });

const shutdown = async () => {
  await mastra.shutdown?.().catch(() => {});
  await cacheClient.quit().catch(() => {});
  process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

console.info('ready');
