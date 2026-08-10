/**
 * Proves against a real Redis that agent thread-stream subscribers do not leak
 * pending entries.
 *
 * Each fan-out subscriber gets a private consumer group (`__fanout-<uuid>`).
 * Redis keeps every delivered entry in that group's PEL until the consumer
 * XACKs it, so a subscriber that never acknowledges leaves the PEL growing for
 * the lifetime of the subscription. These tests drive the real
 * AgentThreadStreamRuntime subscribers over RedisStreamsPubSub and assert the
 * PEL drains to zero.
 */
import { createClient } from 'redis';
import type { RedisClientType } from 'redis';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

// AgentThreadStreamRuntime is internal to @mastra/core with no public export,
// and these tests have to drive its real subscribers to observe the PEL.
import { AgentThreadStreamRuntime } from '../../../packages/core/src/agent/thread-stream-runtime';
import { flushRedis, REDIS_URL, waitFor } from '../test-fixtures/harness';
import { RedisStreamsPubSub } from './index';

const AGENT_THREAD_KEY_SEPARATOR = '\u0000';

function threadStreamKeyFor(resourceId: string, threadId: string): string {
  const key = `${resourceId}${AGENT_THREAD_KEY_SEPARATOR}${threadId}`;
  return `mastra:topic:agent.thread-stream.${encodeURIComponent(key)}`;
}

function threadTopicFor(resourceId: string, threadId: string): string {
  return `agent.thread-stream.${encodeURIComponent(`${resourceId}${AGENT_THREAD_KEY_SEPARATOR}${threadId}`)}`;
}

let inspector: RedisClientType;

/** Total entries still pending across every consumer group on the stream. */
async function pendingCount(streamKey: string): Promise<number> {
  const exists = await inspector.exists(streamKey);
  if (!exists) return 0;
  const groups = (await inspector.xInfoGroups(streamKey)) as Array<{ name: string; pending: number }>;
  return groups.reduce((total, group) => total + Number(group.pending ?? 0), 0);
}

/** Names of every consumer group currently attached to the stream. */
async function groupNames(streamKey: string): Promise<string[]> {
  const exists = await inspector.exists(streamKey);
  if (!exists) return [];
  const groups = (await inspector.xInfoGroups(streamKey)) as Array<{ name: string }>;
  return groups.map(group => group.name);
}

async function entryCount(streamKey: string): Promise<number> {
  const exists = await inspector.exists(streamKey);
  if (!exists) return 0;
  return await inspector.xLen(streamKey);
}

const agent = { id: 'redis-ack-agent' } as any;

describe('agent thread-stream Redis acknowledgements', () => {
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
    while (created.length) {
      await created.pop()?.close?.();
    }
    await flushRedis();
  });

  it('drains the PEL for a thread subscriber that consumed a full remote run', async () => {
    const threadId = `ack-thread-${Date.now()}`;
    const resourceId = 'ack-user';
    const streamKey = threadStreamKeyFor(resourceId, threadId);
    const topic = threadTopicFor(resourceId, threadId);

    // Subscriber process.
    const subscriberPubSub = makePubSub();
    const subscriberRuntime = new AgentThreadStreamRuntime();
    const subscription = await subscriberRuntime.subscribeToThread(agent, { threadId, resourceId }, subscriberPubSub);

    // Producer process — a separate pubsub instance so every event crosses
    // Redis instead of being short-circuited by local delivery.
    const producer = makePubSub();
    const runId = 'remote-run-1';
    const streamId = 'remote-stream-1';
    const publish = (data: Record<string, unknown>) =>
      producer.publish(topic, { type: 'agent.thread-stream', runId, data } as any);

    await publish({ type: 'run-registered', runId, streamId, streamSeq: 1 });
    for (let i = 0; i < 5; i++) {
      await publish({
        type: 'stream-part',
        runId,
        streamId,
        sourceId: 'producer-process',
        part: { type: 'text-delta', payload: { text: `chunk-${i}` } },
      });
    }
    await publish({ type: 'run-completed', runId, streamId });

    // All seven events must land on the stream and then be acknowledged.
    await waitFor(async () => (await entryCount(streamKey)) === 7);
    await waitFor(async () => (await pendingCount(streamKey)) === 0);

    expect(await pendingCount(streamKey)).toBe(0);

    subscription.unsubscribe();
  });

  it('drains the PEL for events the subscriber filters out', async () => {
    const threadId = `ack-thread-filtered-${Date.now()}`;
    const resourceId = 'ack-user';
    const streamKey = threadStreamKeyFor(resourceId, threadId);
    const topic = threadTopicFor(resourceId, threadId);

    const subscriberPubSub = makePubSub();
    const subscriberRuntime = new AgentThreadStreamRuntime();
    const subscription = await subscriberRuntime.subscribeToThread(agent, { threadId, resourceId }, subscriberPubSub);

    const producer = makePubSub();
    // Events with no runtime payload, and an abort request for a run this
    // process knows nothing about, are both ignored by the handler. Ignored
    // still means delivered, so they must still be acknowledged.
    await producer.publish(topic, { type: 'agent.thread-stream', runId: 'noop-run' } as any);
    await producer.publish(topic, {
      type: 'agent.thread-stream',
      runId: 'unknown-run',
      data: { type: 'run-abort-requested', runId: 'unknown-run', streamId: 'unknown-stream' },
    } as any);

    await waitFor(async () => (await entryCount(streamKey)) === 2);
    await waitFor(async () => (await pendingCount(streamKey)) === 0);

    expect(await pendingCount(streamKey)).toBe(0);

    subscription.unsubscribe();
  });

  it('drains the PEL for the cross-agent waiter once the remote run finishes', async () => {
    const threadId = `ack-thread-waiter-${Date.now()}`;
    const resourceId = 'ack-user';
    const streamKey = threadStreamKeyFor(resourceId, threadId);
    const topic = threadTopicFor(resourceId, threadId);

    const waiterPubSub = makePubSub();
    const waiterRuntime = new AgentThreadStreamRuntime();
    const runId = 'remote-run-2';
    const streamId = 'remote-stream-2';

    // Seed this process's view of the thread with a remote run holding the
    // lease, so waitForCrossAgentThreadRun routes through the remote waiter.
    const seeding = await waiterRuntime.subscribeToThread(agent, { threadId, resourceId }, waiterPubSub);
    const producer = makePubSub();
    await producer.acquireLease(`${resourceId}${AGENT_THREAD_KEY_SEPARATOR}${threadId}`, runId, 60_000);
    await producer.publish(topic, {
      type: 'agent.thread-stream',
      runId,
      data: { type: 'run-registered', runId, streamId, streamSeq: 1 },
    } as any);
    await waitFor(async () => (await pendingCount(streamKey)) === 0);
    const seedingGroups = await groupNames(streamKey);
    seeding.unsubscribe();

    const waiting = waiterRuntime.waitForCrossAgentThreadRun(
      { id: 'other-agent' } as any,
      { memory: { thread: threadId, resource: resourceId } } as any,
      waiterPubSub,
    );

    // Both sides are asynchronous: the seeder unsubscribes fire-and-forget and
    // the waiter subscribes inside the promise above. Publishing before the
    // waiter's group exists would read from the tail and hang the waiter;
    // publishing while the seeder's group still exists would leave entries
    // pending behind a group nobody drains.
    await waitFor(async () => {
      const groups = await groupNames(streamKey);
      return groups.length === 1 && !seedingGroups.includes(groups[0]!);
    });

    await producer.publish(topic, {
      type: 'agent.thread-stream',
      runId,
      data: {
        type: 'stream-part',
        runId,
        streamId,
        sourceId: 'producer-process',
        part: { type: 'text-delta', payload: { text: 'hi' } },
      },
    } as any);
    await producer.releaseLease(`${resourceId}${AGENT_THREAD_KEY_SEPARATOR}${threadId}`, runId);
    await producer.publish(topic, {
      type: 'agent.thread-stream',
      runId,
      data: { type: 'run-completed', runId, streamId },
    } as any);

    await waiting;

    // The waiter unsubscribes as it resolves; nothing it consumed may be left
    // pending behind the removed consumer group.
    await waitFor(async () => (await pendingCount(streamKey)) === 0);
    expect(await pendingCount(streamKey)).toBe(0);
  });
});
