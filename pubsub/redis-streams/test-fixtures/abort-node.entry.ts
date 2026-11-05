/**
 * One server of a two-server deploy for the cross-server run abort test: LibSQL
 * on a shared file, RedisStreamsPubSub, and the real HTTP server from
 * `createNodeServer` on PORT. Both servers register the same agent; whichever
 * one the test tells to `stream` owns the run.
 *
 * Reads newline-delimited JSON commands on stdin, writes newline-delimited
 * JSON events on stdout:
 *   {"cmd":"stream"} -> run, tool-started, stream-done
 */
import { createInterface } from 'node:readline';

import { createOpenAI } from '@ai-sdk/openai-v5';
import { Agent } from '@mastra/core/agent';
import { createDurableAgent, createEventedAgent } from '@mastra/core/agent/durable';
import { CachingPubSub } from '@mastra/core/events';
import { Mastra } from '@mastra/core/mastra';
import { createTool } from '@mastra/core/tools';
import { createNodeServer } from '@mastra/deployer/server';
import { LibSQLStore } from '@mastra/libsql';
import { createClient } from 'redis';
import { z } from 'zod';

import { nodeRedisPreset, RedisServerCache } from '../../../stores/redis/src/cache';
import { RedisStreamsPubSub } from '../src/index';

const { REDIS_URL, KEY_PREFIX, STORAGE_URL, LLM_URL, ENGINE = 'durable', NODE_ID = 'node', PORT } = process.env;

function emit(event: Record<string, unknown>) {
  process.stdout.write(`${JSON.stringify({ node: NODE_ID, ...event })}\n`);
}

/** Blocks until the run is aborted, so only an abort ends it before the test times out. */
const waitTool = createTool({
  id: 'wait',
  description: 'Waits.',
  inputSchema: z.object({}),
  execute: async (_input, context) => {
    emit({ type: 'tool-started' });
    const signal = context?.abortSignal;
    await new Promise<void>(resolve => {
      const timer = setTimeout(resolve, 30_000);
      signal?.addEventListener('abort', () => {
        clearTimeout(timer);
        resolve();
      });
    });
    emit({ type: 'tool-finished', aborted: !!signal?.aborted });
    return { waited: true };
  },
});

async function main() {
  const cacheClient = createClient({ url: REDIS_URL });
  await cacheClient.connect();

  const storage = new LibSQLStore({ id: 'abort-storage', url: STORAGE_URL! });
  const openai = createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${LLM_URL}/v1` });
  const base = new Agent({
    id: 'abort-agent',
    name: 'Abort Agent',
    instructions: 'You are a test agent driven by scripted AIMock responses.',
    model: openai('gpt-4o-mini'),
    tools: { wait: waitTool },
  });
  const redisPubsub = new RedisStreamsPubSub({ url: REDIS_URL, keyPrefix: KEY_PREFIX, blockMs: 200 });
  const cache = new RedisServerCache(
    { client: cacheClient as any },
    { ...nodeRedisPreset, keyPrefix: `${KEY_PREFIX}:cache` },
  );
  const pubsub = ENGINE === 'evented' ? new CachingPubSub(redisPubsub, cache) : redisPubsub;
  const agent = ENGINE === 'evented' ? createEventedAgent({ agent: base }) : createDurableAgent({ agent: base });

  const mastra = new Mastra({
    logger: false,
    storage,
    pubsub,
    cache,
    agents: { 'abort-agent': agent },
    server: { port: Number(PORT) },
  });
  const durable: any = mastra.getAgent('abort-agent' as any);

  async function stream(cmd: any) {
    const run = await durable.stream('Wait, then reply.', { maxSteps: 3 });
    emit({ type: 'run', runId: run.runId });
    let finishReason: string | undefined;
    const chunkTypes: string[] = [];
    try {
      for await (const chunk of run.fullStream) {
        chunkTypes.push(chunk.type);
        if (chunk.type === 'finish') finishReason = chunk.payload?.stepResult?.reason;
      }
    } catch (error) {
      chunkTypes.push(`threw:${String(error)}`);
    }
    emit({ type: 'stream-done', runId: run.runId, finishReason, chunkTypes });
  }

  const handlers: Record<string, (cmd: any) => Promise<void> | void> = { stream };

  createInterface({ input: process.stdin }).on('line', line => {
    if (!line.trim()) return;
    const cmd = JSON.parse(line);
    Promise.resolve()
      .then(() => handlers[cmd.cmd]!(cmd))
      .catch(error => emit({ type: 'error', cmd: cmd.cmd, message: String(error?.stack ?? error) }));
  });

  const server = await createNodeServer(mastra, { tools: {}, studio: false, isDev: false });

  const shutdown = async () => {
    await mastra.shutdown?.().catch(() => {});
    server.close();
    await cacheClient.quit().catch(() => {});
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  emit({ type: 'ready' });
}

main().catch(error => {
  emit({ type: 'error', message: String(error?.stack ?? error) });
  process.exit(1);
});
