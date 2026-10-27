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
  registrationOptions?: Parameters<AgentThreadStreamRuntime['registerRun']>[4],
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
    registrationOptions,
  );
  return {
    registered,
    end: (status: 'success' | 'suspended' | 'failed') => {
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

  it('recovers the current outcome rather than a superseded failure after trimming (COR-1500)', async () => {
    const writer = makePubSub();
    const resourceId = 'recovered-user';
    const threadId = 'recovered-thread';
    const runId = 'recovered-run';
    const topic = `agent.thread-stream.${encodeURIComponent(`${resourceId}${SEP}${threadId}`)}`;
    for (const data of [
      { type: 'run-registered', runId, streamId: 'old', streamSeq: 1, generation: 1 },
      { type: 'run-registered', runId, streamId: 'new', streamSeq: 2, generation: 2, supersedes: true },
      { type: 'run-completed', runId, streamId: 'old', status: 'failed', persisted: false },
      { type: 'run-completed', runId, streamId: 'new', status: 'success', persisted: true },
    ]) {
      await writer.publish(topic, { type: 'agent.thread-stream', runId, data });
    }
    await writer.trimTopic(topic, { runId, retainTerminalEvents: true });
    await writer.close();
    const subscription = await new AgentThreadStreamRuntime().subscribeToThread(
      makeAgent(() => []),
      { resourceId, threadId, withInitialHistory: true },
      makePubSub(),
    );
    const chunks: any[] = [];
    const consumed = (async () => {
      for await (const chunk of subscription.stream) chunks.push(chunk);
    })();
    try {
      await waitFor(() => chunks.some(chunk => chunk.type === 'thread-run-status'));
      expect(chunks.map(chunk => chunk.type)).toEqual(['thread-history', 'thread-run-status']);
      expect(chunks[1]).toMatchObject({ runId, payload: { status: 'success' } });
    } finally {
      subscription.unsubscribe();
      await consumed;
    }
  });

  it.each(['failed', 'aborted'] as const)(
    'does not report a superseded %s after MAXLEN evicts its registration (COR-1500)',
    async terminal => {
      const writer = makePubSub();
      const ids = { runId: 'evicted-run', threadId: 'evicted-thread', resourceId: 'evicted-user', messageId: 'm1' };
      const key = streamKeyFor(ids.resourceId, ids.threadId);
      const agent = makeAgent(() => []);
      let ownershipLost = false;
      const originalRuntime = new AgentThreadStreamRuntime();
      originalRuntime.prepareRunOptions(
        { runId: ids.runId, memory: { thread: ids.threadId, resource: ids.resourceId } },
        writer,
      );
      const original = startRun(originalRuntime, agent, writer, ids, [], {
        generation: 1,
        ownershipLost: () => ownershipLost,
      });
      await original.registered;
      const recovered = startRun(new AgentThreadStreamRuntime(), agent, writer, ids, [], { generation: 2 });
      await recovered.registered;
      ownershipLost = true;
      await inspector.xTrim(key, 'MAXLEN', 0);
      if (terminal === 'aborted') originalRuntime.abortRun(ids.runId, writer);
      else original.end('failed');
      await waitFor(async () =>
        (await inspector.xRange(key, '-', '+')).some(
          entry =>
            JSON.parse(entry.message.event).data.type === (terminal === 'aborted' ? 'run-aborted' : 'run-completed'),
        ),
      );
      recovered.end('success');
      await waitFor(async () => (await entryCount(key)) === 2);
      await writer.close();
      const subscription = await new AgentThreadStreamRuntime().subscribeToThread(
        agent,
        { ...ids, withInitialHistory: true },
        makePubSub(),
      );
      const chunks: any[] = [];
      const consumed = (async () => {
        for await (const chunk of subscription.stream) chunks.push(chunk);
      })();
      try {
        await waitFor(() => chunks.some(chunk => chunk.type === 'thread-run-status'));
        expect(chunks.map(chunk => chunk.type)).toEqual(['thread-history', 'thread-run-status']);
        expect(chunks[1]).toMatchObject({ runId: ids.runId, payload: { status: 'success' } });
      } finally {
        subscription.unsubscribe();
        await consumed;
      }
    },
  );

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
    await waitFor(async () => (await entryCount(key)) === 2);

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
    expect(collected.map(p => p.type)).toEqual(['thread-history', 'thread-run-status']);
    expect(collected[0].payload.activeRunId).toBeNull();
    expect(collected[1]).toMatchObject({ runId: 'done-run', payload: { status: 'success' } });
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
    await waitFor(async () => (await entryCount(key)) === 3);
  });
});
