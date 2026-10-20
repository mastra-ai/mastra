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
 */
import { createInterface } from 'node:readline';

import { createOpenAI } from '@ai-sdk/openai-v5';
import { Agent } from '@mastra/core/agent';
import { createDurableAgent, createEventedAgent } from '@mastra/core/agent/durable';
import { Mastra } from '@mastra/core/mastra';
import { createTool } from '@mastra/core/tools';
import { LibSQLStore } from '@mastra/libsql';
import { createClient } from 'redis';
import { z } from 'zod';

import { nodeRedisPreset, RedisServerCache } from '../../../stores/redis/src/cache';
import { RedisStreamsPubSub } from '../src/index';

const { REDIS_URL, KEY_PREFIX, STORAGE_URL, LLM_URL, ENGINE = 'durable', NODE_ID = 'node' } = process.env;

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
  const pubsub = new RedisStreamsPubSub({ url: REDIS_URL, keyPrefix: KEY_PREFIX, blockMs: 200 });
  const agent = ENGINE === 'evented' ? createEventedAgent({ agent: base }) : createDurableAgent({ agent: base });

  const mastra = new Mastra({
    logger: false,
    storage: new LibSQLStore({ id: 'observe-storage', url: STORAGE_URL! }),
    pubsub,
    cache: new RedisServerCache(
      { client: cacheClient as any },
      { ...nodeRedisPreset, keyPrefix: `${KEY_PREFIX}:cache` },
    ),
    agents: { observerAgent: agent },
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

  const handlers: Record<string, (cmd: any) => Promise<void> | void> = {
    stream,
    approve,
    observe,
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

  const shutdown = async () => {
    for (const observation of observations.values()) observation.detach();
    await mastra.shutdown?.().catch(() => {});
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
