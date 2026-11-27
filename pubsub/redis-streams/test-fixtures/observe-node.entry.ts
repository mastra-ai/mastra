/**
 * One Mastra instance of a two-instance deploy for the cross-process observe()
 * test: LibSQL on a shared file, RedisStreamsPubSub and a Redis server cache.
 * Both instances register the same durable agent; whichever process the test
 * tells to `stream` owns the run, the other only observes it.
 *
 * Reads newline-delimited JSON commands on stdin, writes newline-delimited
 * JSON events on stdout:
 *   {"cmd":"stream","prompt":"..","requireToolApproval":true} -> run, approval?, stream-done
 *   {"cmd":"release"}                    -> releases the `wait_gate` tool
 *   {"cmd":"approve","runId","toolCallId"} -> resume-done
 *   {"cmd":"observe","id","runId"}       -> observed, chunk*, closed
 *   {"cmd":"detach","id"}
 *
 * With ROLE set it is one process of a split deploy instead (observe-by-index
 * restart test, COR-1506): ROLE=api serves HTTP on PORT with `createNodeServer`,
 * ROLE=worker runs the agentic loop with `startWorkers()`. stdin is unused and
 * setting `${KEY_PREFIX}:gate` in Redis releases `wait_gate`.
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

const { REDIS_URL, KEY_PREFIX, STORAGE_URL, LLM_URL, ENGINE = 'durable', NODE_ID = 'node', ROLE, PORT } = process.env;

function emit(event: Record<string, unknown>) {
  process.stdout.write(`${JSON.stringify({ node: NODE_ID, ...event })}\n`);
}

let releaseGate: () => void = () => {};
const gate = new Promise<void>(resolve => (releaseGate = resolve));

const waitGate = createTool({
  id: 'wait_gate',
  description: 'Waits until the operator releases it.',
  inputSchema: z.object({ step: z.string() }),
  execute: async ({ step }) => {
    emit({ type: 'tool-started', step });
    await gate;
    return { released: step };
  },
});

const lookup = createTool({
  id: 'lookup_status',
  description: 'Look up a status.',
  inputSchema: z.object({ query: z.string() }),
  execute: async ({ query }) => {
    emit({ type: 'tool-executed', query });
    return { status: `OK:${query}` };
  },
});

async function main() {
  const cacheClient = createClient({ url: REDIS_URL });
  await cacheClient.connect();

  const openai = createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${LLM_URL}/v1` });
  const base = new Agent({
    id: 'observer-agent',
    name: 'Observer Agent',
    instructions: 'You are a test agent driven by scripted AIMock responses.',
    model: openai('gpt-4o-mini'),
    tools: { wait_gate: waitGate, lookup_status: lookup },
  });
  const writer = createClient<{}, {}, {}, 2, {}>({ url: REDIS_URL });
  const redisPubsub = new RedisStreamsPubSub({ client: writer, keyPrefix: KEY_PREFIX, blockMs: 200 });
  const cache = new RedisServerCache(
    { client: cacheClient as any },
    { ...nodeRedisPreset, keyPrefix: `${KEY_PREFIX}:cache` },
  );
  const pubsub = process.env.PREWRAPPED_PUBSUB === '1' ? new CachingPubSub(redisPubsub, cache) : redisPubsub;
  const executionEngine = ENGINE === 'native-default' ? 'default' : ENGINE === 'native-evented' ? 'evented' : undefined;
  const storage = new LibSQLStore({ id: 'observe-storage', url: STORAGE_URL! });
  const agent = executionEngine
    ? base
    : ENGINE === 'evented'
      ? createEventedAgent({ agent: base })
      : createDurableAgent({ agent: base });

  const mastra = new Mastra({
    logger: false,
    storage,
    ...(executionEngine && { durable: { executionEngine } }),
    pubsub,
    cache,
    agents: { observerAgent: agent },
    ...(ROLE === 'api' ? { server: { port: Number(PORT) } } : {}),
  });
  const durable: any = mastra.getAgent('observerAgent');

  const observations = new Map<string, { detach: () => void }>();

  async function stream(cmd: any) {
    const run = await durable.stream(cmd.prompt, { maxSteps: 5, requireToolApproval: !!cmd.requireToolApproval });
    emit({ type: 'run', runId: run.runId });
    let finishReason: string | undefined;
    for await (const chunk of run.fullStream) {
      if (chunk.type === 'tool-call-approval') {
        emit({ type: 'approval', runId: run.runId, toolCallId: chunk.payload.toolCallId });
      }
      if (chunk.type === 'error')
        emit({
          type: 'run-error',
          runId: run.runId,
          message: String(chunk.payload?.error?.stack ?? chunk.payload?.error ?? JSON.stringify(chunk.payload)),
        });
      if (chunk.type === 'finish') finishReason = chunk.payload?.stepResult?.reason;
    }
    emit({ type: 'stream-done', runId: run.runId, finishReason });
  }

  async function approve(cmd: any) {
    const resumed = await durable.approveToolCall({ runId: cmd.runId, toolCallId: cmd.toolCallId });
    for await (const _ of resumed.fullStream) {
      // drain the resumed turn
    }
    emit({ type: 'resume-done', runId: cmd.runId });
  }

  async function observe(cmd: any) {
    const observation = await durable.observe(cmd.runId);
    observations.set(cmd.id, observation);
    emit({ type: 'observed', id: cmd.id });
    for await (const chunk of observation.fullStream) {
      emit({
        type: 'chunk',
        id: cmd.id,
        chunk: chunk.type,
        text: chunk.type === 'text-delta' ? chunk.payload?.text : undefined,
      });
    }
    emit({ type: 'closed', id: cmd.id });
  }

  const shutdown = async () => {
    for (const observation of observations.values()) observation.detach();
    await mastra.shutdown?.().catch(() => {});
    await cacheClient.quit().catch(() => {});
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  if (ROLE) {
    const gatePoll = setInterval(async () => {
      if (await cacheClient.get(`${KEY_PREFIX}:gate`).catch(() => null)) {
        clearInterval(gatePoll);
        releaseGate();
      }
    }, 50);
    if (ROLE === 'worker') await mastra.startWorkers();
    else await createNodeServer(mastra, { tools: {}, studio: false, isDev: false });
    emit({ type: 'ready' });
    return;
  }

  const handlers: Record<string, (cmd: any) => Promise<void> | void> = {
    stream,
    approve,
    observe,
    async followUpAtFinish(cmd) {
      const releaseLease = redisPubsub.releaseLease.bind(redisPubsub);
      const acquireLease = redisPubsub.acquireLease.bind(redisPubsub);
      const firstRunId = `${cmd.threadId}-first`;
      const secondRunId = `${cmd.threadId}-second`;
      const memory = { thread: cmd.threadId, resource: 'follow-up-test' };
      let allowRelease!: () => void;
      const releaseGate = new Promise<void>(resolve => (allowRelease = resolve));
      redisPubsub.releaseLease = async (key, owner) => {
        if (key.endsWith(cmd.threadId) && owner.includes(firstRunId)) await releaseGate;
        return releaseLease(key, owner);
      };
      const set = writer.set.bind(writer);
      let releasedBetweenCommands = false;
      let failedSets = 0;
      if (cmd.releaseOnFailedSet) {
        const setWithRelease: typeof writer.set = async (key, owner, options) => {
          const result = await set(key, owner, options);
          if (
            typeof key === 'string' &&
            key.endsWith(cmd.threadId) &&
            typeof owner === 'string' &&
            owner.includes(secondRunId) &&
            result === null &&
            ++failedSets === cmd.releaseOnFailedSet
          ) {
            const previousOwner = await writer.get(key);
            if (!previousOwner?.includes(firstRunId))
              throw new Error('Expected the first run to hold the thread lease');
            await releaseLease(key.slice(`${KEY_PREFIX}:lease:`.length), previousOwner);
            releasedBetweenCommands = true;
          }
          return result;
        };
        Object.defineProperty(writer, 'set', { configurable: true, value: setWithRelease });
      }
      let releaseTimer: ReturnType<typeof setTimeout> | undefined;
      redisPubsub.acquireLease = async (key, owner, ttl) => {
        const result = await acquireLease(key, owner, ttl);
        if (
          releasedBetweenCommands &&
          key.endsWith(cmd.threadId) &&
          owner.includes(secondRunId) &&
          !result.acquired &&
          result.owner === undefined
        ) {
          emit({ type: 'follow-up-ownerless' });
        }
        if (
          !cmd.releaseOnFailedSet &&
          !releaseTimer &&
          key.endsWith(cmd.threadId) &&
          owner.includes(secondRunId) &&
          result.owner?.includes(firstRunId)
        ) {
          emit({ type: 'follow-up-contended' });
          releaseTimer = setTimeout(allowRelease, 2_000);
        }
        return result;
      };
      try {
        const first = await durable.stream('First turn', { runId: firstRunId, memory });
        for await (const chunk of first.fullStream) {
          if (chunk.type !== 'finish') continue;
          const second = await durable.stream('Follow-up turn', { runId: secondRunId, memory });
          let text = '';
          for await (const part of second.fullStream) {
            if (part.type === 'error') throw part.payload.error;
            if (part.type === 'text-delta') text += part.payload.text;
          }
          emit({ type: 'follow-up-done', text });
          return;
        }
        throw new Error('First turn ended without a finish frame');
      } finally {
        clearTimeout(releaseTimer);
        if (cmd.releaseOnFailedSet) Reflect.deleteProperty(writer, 'set');
        allowRelease();
        redisPubsub.releaseLease = releaseLease;
        redisPubsub.acquireLease = acquireLease;
      }
    },
    async waitForSuspension(cmd) {
      const workflows = await storage.getStore('workflows');
      const deadline = Date.now() + 10_000;
      while (Date.now() < deadline) {
        const snapshot = await workflows?.loadWorkflowSnapshot({
          workflowName: 'durable-agentic-loop',
          runId: cmd.runId,
        });
        if (snapshot?.status === 'suspended') {
          emit({ type: 'suspension-persisted', runId: cmd.runId });
          return;
        }
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      throw new Error(`No suspended checkpoint for ${cmd.runId}`);
    },
    release: () => releaseGate(),
    detach: cmd => observations.get(cmd.id)?.detach(),
  };

  createInterface({ input: process.stdin }).on('line', line => {
    if (!line.trim()) return;
    const cmd = JSON.parse(line);
    Promise.resolve()
      .then(() => handlers[cmd.cmd]!(cmd))
      .catch(error => emit({ type: 'error', cmd: cmd.cmd, id: cmd.id, message: String(error?.stack ?? error) }));
  });

  emit({ type: 'ready' });
}

main().catch(error => {
  emit({ type: 'error', message: String(error?.stack ?? error) });
  process.exit(1);
});
