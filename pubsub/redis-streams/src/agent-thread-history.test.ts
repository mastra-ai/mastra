/**
 * Proves against a real Redis that a thread topic is trimmed once a run is
 * saved, and that a restarted process subscribing with `withInitialHistory`
 * gets stored history instead of replaying finished runs, while a suspended
 * run's pending approval is still delivered.
 */
import { createClient } from 'redis';
import type { RedisClientType } from 'redis';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

// AgentThreadStreamRuntime is internal to @mastra/core with no public export.
import { AgentThreadStreamRuntime } from '../../../packages/core/src/agent/thread-stream-runtime';
import { flushRedis, REDIS_URL, waitFor } from '../test-fixtures/harness';
import { RedisStreamsPubSub } from './index';

const SEP = '\u0000';
const streamKeyFor = (resourceId: string, threadId: string) =>
  `mastra:topic:agent.thread-stream.${encodeURIComponent(`${resourceId}${SEP}${threadId}`)}`;

let inspector: RedisClientType;

async function entryCount(key: string) {
  return (await inspector.exists(key)) ? await inspector.xLen(key) : 0;
}

function makeAgent(stored: () => unknown[]) {
  return {
    id: 'redis-history-agent',
    getMemory: async () => ({
      getThreadById: async ({ threadId }: { threadId: string }) => ({ id: threadId }),
      recall: async () => ({ messages: [...stored()].reverse(), hasMore: false }),
    }),
  } as any;
}

function startRun(
  runtime: AgentThreadStreamRuntime,
  agent: any,
  pubsub: RedisStreamsPubSub,
  ids: { runId: string; threadId: string; resourceId: string; messageId: string },
  parts: Array<Record<string, unknown>>,
) {
  let finish!: () => void;
  const finished = new Promise<void>(resolve => (finish = resolve));
  const output = {
    runId: ids.runId,
    status: 'running',
    fullStream: new ReadableStream({
      start(controller) {
        controller.enqueue({ type: 'start', runId: ids.runId, payload: { messageId: ids.messageId } });
        for (const part of parts) controller.enqueue({ runId: ids.runId, ...part });
        controller.close();
      },
    }),
    _waitUntilFinished: () => finished,
  } as any;
  const registered = runtime.registerRun(
    agent,
    output,
    { memory: { thread: ids.threadId, resource: ids.resourceId } } as any,
    pubsub,
  );
  return {
    registered,
    end: (status: 'success' | 'suspended') => {
      output.status = status;
      finish();
    },
  };
}

describe('agent thread history over Redis', () => {
  const created: RedisStreamsPubSub[] = [];
  const makePubSub = () => {
    const pubsub = new RedisStreamsPubSub({ url: REDIS_URL });
    created.push(pubsub);
    return pubsub;
  };

  beforeAll(async () => {
    inspector = createClient({ url: REDIS_URL }) as RedisClientType;
    await inspector.connect();
  });
  afterAll(async () => {
    await inspector.quit();
  });
  afterEach(async () => {
    while (created.length) await created.pop()?.close?.();
    await flushRedis();
  });

  it('trims a saved run and a restarted subscriber sees history without replay', async () => {
    const threadId = `history-thread-${Date.now()}`;
    const resourceId = 'history-user';
    const key = streamKeyFor(resourceId, threadId);
    let stored: unknown[] = [];
    const agent = makeAgent(() => stored);

    const run = startRun(
      new AgentThreadStreamRuntime(),
      agent,
      makePubSub(),
      { runId: 'done-run', threadId, resourceId, messageId: 'm1' },
      [
        { type: 'text-delta', payload: { text: 'answer' } },
        { type: 'finish', payload: {} },
      ],
    );
    await run.registered;
    await waitFor(async () => (await entryCount(key)) > 0);
    stored = [
      { id: 'm1', role: 'assistant', threadId, resourceId, createdAt: new Date(), content: { format: 2, parts: [] } },
    ];
    run.end('success');
    await waitFor(async () => (await entryCount(key)) === 0);

    // "Restart": a new process with its own pubsub connection and runtime.
    const subscription = await new AgentThreadStreamRuntime().subscribeToThread(
      agent,
      { threadId, resourceId, withInitialHistory: true },
      makePubSub(),
    );
    const collected: any[] = [];
    const consumed = (async () => {
      for await (const part of subscription.stream) collected.push(part);
    })();
    await new Promise(resolve => setTimeout(resolve, 300));
    expect(collected.map(p => p.type)).toEqual(['thread-history']);
    subscription.unsubscribe();
    await consumed;
  });

  it('keeps a suspended run and re-delivers its pending approval once after restart', async () => {
    const threadId = `history-suspended-${Date.now()}`;
    const resourceId = 'history-user';
    const key = streamKeyFor(resourceId, threadId);
    const approval = { toolCallId: 'tc-1', toolName: 'transition', args: {} };
    const stored = [
      {
        id: 'm1',
        role: 'assistant',
        threadId,
        resourceId,
        createdAt: new Date(),
        content: { format: 2, parts: [], metadata: { pendingToolApprovals: { 'tc-1': approval } } },
      },
    ];
    const agent = makeAgent(() => stored);

    const run = startRun(
      new AgentThreadStreamRuntime(),
      agent,
      makePubSub(),
      { runId: 'suspended-run', threadId, resourceId, messageId: 'm1' },
      [{ type: 'tool-call-approval', payload: approval }],
    );
    await run.registered;
    run.end('suspended');
    await waitFor(async () => (await entryCount(key)) > 0);
    await new Promise(resolve => setTimeout(resolve, 200));
    expect(await entryCount(key)).toBeGreaterThan(0);

    const subscription = await new AgentThreadStreamRuntime().subscribeToThread(
      agent,
      { threadId, resourceId, withInitialHistory: true },
      makePubSub(),
    );
    const collected: any[] = [];
    const consumed = (async () => {
      for await (const part of subscription.stream) collected.push(part);
    })();
    await new Promise(resolve => setTimeout(resolve, 300));
    expect(collected[0].type).toBe('thread-history');
    expect(collected.filter(p => p.type === 'tool-call-approval')).toHaveLength(1);
    expect(collected.filter(p => p.type === 'text-delta')).toHaveLength(0);
    subscription.unsubscribe();
    await consumed;

    // Answered after the restart: the resumed run reuses the runId on a fresh
    // runtime, and its completion must also drop the pre-restart entries.
    const resumed = startRun(
      new AgentThreadStreamRuntime(),
      agent,
      makePubSub(),
      { runId: 'suspended-run', threadId, resourceId, messageId: 'm1' },
      [],
    );
    await resumed.registered;
    resumed.end('success');
    await waitFor(async () => (await entryCount(key)) === 0);
  });
});
