/**
 * One server of a two-server deploy for the cross-server plain Agent run
 * tests: a plain (non-durable) Agent with resumable streams, LibSQL on a shared
 * file, RedisStreamsPubSub, RedisServerCache, SimpleAuth that maps each bearer
 * token to a resource, and the real HTTP server from `createNodeServer` on
 * PORT. Both servers register the same agent; whichever one the test tells to
 * `stream` executes the run.
 *
 * Env: STREAMS_CACHE=false turns replay caching off; CLEANUP_MS sets
 * `streams.cleanupTimeoutMs`.
 *
 * Reads newline-delimited JSON commands on stdin, writes newline-delimited
 * JSON events on stdout:
 *   {"cmd":"stream","tool":"wait"|"approve","resourceId"} -> run, tool-started | suspended, stream-done
 *   {"cmd":"approve","runId","toolCallId","resourceId"}   -> approved-done
 */
import { createInterface } from 'node:readline';

import { createOpenAI } from '@ai-sdk/openai-v5';
import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { MASTRA_RESOURCE_ID_KEY, RequestContext } from '@mastra/core/request-context';
import { SimpleAuth } from '@mastra/core/server';
import { createTool } from '@mastra/core/tools';
import { createNodeServer } from '@mastra/deployer/server';
import { LibSQLStore } from '@mastra/libsql';
import { createClient } from 'redis';
import { z } from 'zod';

import { nodeRedisPreset, RedisServerCache } from '../../../stores/redis/src/cache';
import { RedisStreamsPubSub } from '../src/index';

const { REDIS_URL, KEY_PREFIX, STORAGE_URL, LLM_URL, NODE_ID = 'node', PORT, STREAMS_CACHE, CLEANUP_MS } = process.env;

function emit(event: Record<string, unknown>) {
  process.stdout.write(`${JSON.stringify({ node: NODE_ID, ...event })}\n`);
}

let toolRuns = 0;

/** Blocks until the run is aborted, so only an abort ends it before the test times out. */
const waitTool = createTool({
  id: 'wait',
  description: 'Waits.',
  inputSchema: z.object({}),
  execute: async (_input, context) => {
    toolRuns++;
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

const approveTool = createTool({
  id: 'approve',
  description: 'Needs approval.',
  inputSchema: z.object({}),
  requireApproval: true,
  execute: async () => {
    toolRuns++;
    emit({ type: 'tool-executed', toolRuns });
    return { ok: true };
  },
});

const asResource = (resourceId: string) => new RequestContext([[MASTRA_RESOURCE_ID_KEY, resourceId]]);

async function main() {
  const cacheClient = createClient({ url: REDIS_URL });
  await cacheClient.connect();

  const openai = createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${LLM_URL}/v1` });
  const cleanupTimeoutMs = CLEANUP_MS ? Number(CLEANUP_MS) : undefined;
  const agent = new Agent({
    id: 'plain-agent',
    name: 'Plain Agent',
    instructions: 'You are a test agent driven by scripted AIMock responses.',
    model: openai('gpt-4o-mini'),
    tools: { wait: waitTool, approve: approveTool },
    durable: STREAMS_CACHE === 'false' ? { cache: false, cleanupTimeoutMs } : { cleanupTimeoutMs },
  });

  const mastra = new Mastra({
    logger: false,
    storage: new LibSQLStore({ id: 'plain-run-storage', url: STORAGE_URL! }),
    pubsub: new RedisStreamsPubSub({ url: REDIS_URL, keyPrefix: KEY_PREFIX, blockMs: 200 }),
    cache: new RedisServerCache(
      { client: cacheClient as any },
      { ...nodeRedisPreset, keyPrefix: `${KEY_PREFIX}:cache:` },
    ),
    agents: { 'plain-agent': agent },
    server: {
      port: Number(PORT),
      auth: new SimpleAuth<{ id: string }>({
        tokens: { 'token-a': { id: 'user-a' }, 'token-b': { id: 'user-b' } },
        mapUserToResourceId: user => user.id,
      }),
    },
  });
  const registered = mastra.getAgent('plain-agent' as any);

  async function consume(run: any, runId: string) {
    const chunkTypes: string[] = [];
    let finishReason: string | undefined;
    try {
      for await (const chunk of run.fullStream) {
        chunkTypes.push(chunk.type);
        if (chunk.type === 'tool-call-approval') {
          emit({ type: 'suspended', runId, toolCallId: chunk.payload.toolCallId });
        }
        if (chunk.type === 'finish') finishReason = chunk.payload?.stepResult?.reason;
      }
    } catch (error) {
      chunkTypes.push(`threw:${String(error)}`);
    }
    return { chunkTypes, finishReason };
  }

  async function stream(cmd: any) {
    const run = await registered.stream(cmd.tool === 'approve' ? 'Ask for approval.' : 'Wait, then reply.', {
      maxSteps: 3,
      requestContext: asResource(cmd.resourceId),
    });
    emit({ type: 'run', runId: run.runId });
    emit({ type: 'stream-done', runId: run.runId, ...(await consume(run, run.runId)) });
  }

  async function approve(cmd: any) {
    const resumed = await registered.approveToolCall({
      runId: cmd.runId,
      toolCallId: cmd.toolCallId,
      requestContext: asResource(cmd.resourceId),
    });
    const result = await consume(resumed, cmd.runId);
    emit({ type: 'approved-done', runId: cmd.runId, toolRuns, ...result });
  }

  const handlers: Record<string, (cmd: any) => Promise<void> | void> = { stream, approve };

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
