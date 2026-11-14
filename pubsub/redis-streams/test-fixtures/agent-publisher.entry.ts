import { createServer } from 'node:http';
import { createOpenAI } from '@ai-sdk/openai-v5';
import { Agent } from '@mastra/core/agent';
import { createDurableAgent, EventedAgent } from '@mastra/core/agent/durable';
import { Mastra } from '@mastra/core/mastra';
import { createTool } from '@mastra/core/tools';
import { PostgresStore } from '@mastra/pg';
import { createClient } from 'redis';
import { z } from 'zod';
import { RedisServerCache } from '../../../stores/redis/src/cache';
import { RedisStreamsPubSub } from '../src/index';

const runId = process.env.PUBLISHER_RUN_ID!;
const prefix = process.env.PUBLISHER_PREFIX!;
const releases = new Set<() => void>();
const pausedRuns = new Set<string>();
const terminalReleases = new Set<() => void>();
let terminalReleased = false;
let released = false;
// Hold publication after a step result, before the loop advances to its next step.
class PausingPubSub extends RedisStreamsPubSub {
  override async publish(...args: Parameters<RedisStreamsPubSub['publish']>) {
    await super.publish(...args);
    const [topic, event] = args;
    if (
      process.env.PUBLISHER_ENGINE === 'evented' &&
      topic === `agent.stream.${runId}` &&
      ['finish', 'abort', 'error'].includes(event.type) &&
      !terminalReleased
    ) {
      console.info('publisher-terminal-pending');
      await new Promise<void>(resolve => terminalReleases.add(resolve));
    }
    if (
      topic === `agent.stream.${runId}` &&
      event.type === 'chunk' &&
      event.data?.type === 'step-finish' &&
      !released &&
      !pausedRuns.has(runId)
    ) {
      pausedRuns.add(runId);
      console.info('publisher-between-steps');
      await new Promise<void>(resolve => releases.add(resolve));
    }
  }
}
const pubsub = new PausingPubSub({ url: process.env.REDIS_URL, keyPrefix: prefix, blockMs: 100 });
const client = createClient({ url: process.env.REDIS_URL });
await client.connect();
const cache = new RedisServerCache(
  {
    client: {
      get: key => client.get(key),
      set: (key, value, ...args) => client.sendCommand(['SET', key, String(value), ...args.map(String)]),
      llen: key => client.lLen(key),
      rpush: (key, ...values) => client.rPush(key, values.map(String)),
      lrange: (key, start, stop) => client.lRange(key, start, stop),
      del: (...keys) => client.del(keys),
      expire: (key, seconds) => client.expire(key, seconds),
      scan: async cursor => {
        const page = await client.scan(String(cursor), { MATCH: `${prefix}:cache*`, COUNT: 100 });
        return [page.cursor, page.keys];
      },
      incr: key => client.incr(key),
      eval: (script, keyCount, ...args) =>
        client.eval(String(script), {
          keys: args.slice(0, Number(keyCount)).map(String),
          arguments: args.slice(Number(keyCount)).map(String),
        }),
    },
  },
  { keyPrefix: `${prefix}:cache` },
);
const storage = new PostgresStore({
  id: 'publisher-storage',
  connectionString: process.env.POSTGRES_CONNECTION_STRING!,
  schemaName: process.env.PUBLISHER_SCHEMA,
});
const openai = createOpenAI({ apiKey: 'aimock', baseURL: `${process.env.PUBLISHER_MODEL_URL}/v1` });
const base = new Agent({
  id: 'publisher-agent',
  name: 'Publisher Agent',
  instructions: 'Look up the answer, then reply.',
  model: openai('gpt-4o-mini'),
  tools: {
    lookup: createTool({
      id: 'lookup',
      description: 'Look up the answer.',
      inputSchema: z.object({}),
      requireApproval: process.env.PUBLISHER_APPROVAL === '1',
      execute: async () => {
        console.info('publisher-tool-executed');
        return { answer: 42 };
      },
    }),
  },
});
const agent =
  process.env.PUBLISHER_ENGINE === 'durable'
    ? createDurableAgent({ agent: base, cleanupTimeoutMs: 0 })
    : new EventedAgent({ agent: base, cleanupTimeoutMs: 0 });
const mastra = new Mastra({ logger: false, storage, cache, pubsub, agents: { agent } });
await storage.init();
await mastra.startWorkers();
let cleanup: (() => void) | undefined;
let result: { text?: string; error?: string; finishReason?: string } = {};
const server = createServer(async (req, res) => {
  try {
    if (req.url === '/run' || req.url === '/resume') {
      result = {};
      const resuming = req.url === '/resume';
      void (async () => {
        const run = resuming
          ? await agent.resume(runId, { approved: true }, { toolCallId: 'lookup-0' })
          : await agent.stream('Look up the answer.', { runId, maxSteps: 3, closeOnSuspend: false });
        cleanup = run.cleanup;
        result = { text: await run.output.text, finishReason: await run.output.finishReason };
        console.info(`publisher-completed:${result.text}`);
      })().catch(error => {
        result = { error: String(error) };
        console.error(error);
      });
    } else if (req.url === '/abort') {
      res.end(JSON.stringify({ acknowledged: await agent.__abortRunAcknowledged(runId) }));
      return;
    } else if (req.url === '/release-terminal') {
      terminalReleased = true;
      for (const release of terminalReleases) release();
      terminalReleases.clear();
    } else if (req.url === '/release') {
      released = true;
      for (const release of releases) release();
      releases.clear();
    } else if (req.url === '/cleanup') {
      cleanup?.();
    } else if (req.url === '/state') {
      res.end(JSON.stringify({ result, record: await agent.__getRunRecord(runId) }));
      return;
    }
    res.end('{}');
  } catch (error) {
    res.statusCode = 500;
    res.end(String(error));
  }
});
server.listen(0, '127.0.0.1', () => {
  const address = server.address();
  if (address && typeof address !== 'string') console.info(`publisher-ready:${address.port}`);
});
process.once('SIGTERM', async () => {
  for (const release of releases) release();
  for (const release of terminalReleases) release();
  server.close();
  await mastra.shutdown();
  await client.quit();
  process.exit(0);
});
