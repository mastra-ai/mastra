import { describe, it, expect, beforeEach, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const instances: MockUnixSocketPubSub[] = [];
  let mkdirImpl: () => Promise<void> = async () => {};

  class MockPubSub {}

  class MockUnixSocketPubSub {
    readonly socketPath: string;
    readonly published: Array<{ topic: string; event: unknown }> = [];
    readonly subscriptions: string[] = [];
    closed = false;

    constructor(socketPath: string) {
      this.socketPath = socketPath;
      instances.push(this);
    }

    async publish(topic: string, event: unknown): Promise<void> {
      this.published.push({ topic, event });
    }

    async subscribe(topic: string): Promise<void> {
      this.subscriptions.push(topic);
    }

    async unsubscribe(): Promise<void> {}

    async flush(): Promise<void> {}

    async close(): Promise<void> {
      this.closed = true;
    }
  }

  return {
    instances,
    MockPubSub,
    MockUnixSocketPubSub,
    mkdir: vi.fn(() => mkdirImpl()),
    setMkdirImpl: (impl: () => Promise<void>) => {
      mkdirImpl = impl;
    },
  };
});

vi.mock('node:fs/promises', () => ({
  mkdir: mocks.mkdir,
}));

vi.mock('@mastra/core/events', () => ({
  PubSub: mocks.MockPubSub,
  UnixSocketPubSub: mocks.MockUnixSocketPubSub,
}));

const event = { type: 'test', data: {}, runId: 'run-id' };

const threadTopic = (resourceId: string, threadId: string) =>
  `agent.thread-stream.${encodeURIComponent(`${resourceId}\0${threadId}`)}`;

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(res => {
    resolve = res;
  });
  return { promise, resolve };
}

describe('SignalsPubSub', () => {
  beforeEach(() => {
    mocks.instances.length = 0;
    mocks.mkdir.mockClear();
    mocks.setMkdirImpl(async () => {});
    vi.resetModules();
  });

  it('routes thread-stream topics to /tmp/mc/<resourceId>/<threadId>.sock', async () => {
    const { createSignalsPubSub } = await import('../signals-pubsub.js');
    const resourceId = '11111111-1111-4111-8111-111111111111';
    const threadId = '22222222-2222-4222-8222-222222222222';
    const topic = threadTopic(resourceId, threadId);

    const pubsub = createSignalsPubSub(resourceId);
    await pubsub.publish(topic, event);

    expect(mocks.mkdir).toHaveBeenCalledWith(`/tmp/mc/${resourceId}`, { recursive: true });
    expect(mocks.instances).toHaveLength(1);
    expect(mocks.instances[0]?.socketPath).toBe(`/tmp/mc/${resourceId}/${threadId}.sock`);
  });

  it('falls back to a sanitized topic when thread-stream decoding fails', async () => {
    const { createSignalsPubSub } = await import('../signals-pubsub.js');
    const resourceId = '11111111-1111-4111-8111-111111111111';
    const topic = 'agent.thread-stream.%E0%A4%A';

    const pubsub = createSignalsPubSub(resourceId);
    await expect(pubsub.publish(topic, event)).resolves.toBeUndefined();

    expect(mocks.instances).toHaveLength(1);
    expect(mocks.instances[0]?.socketPath).toBe(`/tmp/mc/${resourceId}/agent_thread-stream__E0_A4_A.sock`);
  });

  it('deduplicates concurrent first-time access for the same topic', async () => {
    const mkdir = deferred();
    mocks.setMkdirImpl(() => mkdir.promise);
    const { createSignalsPubSub } = await import('../signals-pubsub.js');
    const resourceId = '11111111-1111-4111-8111-111111111111';
    const threadId = '22222222-2222-4222-8222-222222222222';
    const topic = threadTopic(resourceId, threadId);

    const pubsub = createSignalsPubSub(resourceId);
    const publishPromise = pubsub.publish(topic, event);
    const subscribePromise = pubsub.subscribe(topic, vi.fn());

    await Promise.resolve();
    expect(mocks.instances).toHaveLength(0);

    mkdir.resolve();
    await Promise.all([publishPromise, subscribePromise]);

    expect(mocks.instances).toHaveLength(1);
    expect(mocks.instances[0]?.published).toHaveLength(1);
    expect(mocks.instances[0]?.subscriptions).toEqual([topic]);
  });

  it('does not retain a socket created after close starts', async () => {
    const mkdir = deferred();
    mocks.setMkdirImpl(() => mkdir.promise);
    const { createSignalsPubSub } = await import('../signals-pubsub.js');
    const resourceId = '11111111-1111-4111-8111-111111111111';
    const threadId = '22222222-2222-4222-8222-222222222222';
    const topic = threadTopic(resourceId, threadId);

    const pubsub = createSignalsPubSub(resourceId);
    const publishPromise = pubsub.publish(topic, event);
    await Promise.resolve();

    await pubsub.close();
    mkdir.resolve();

    await expect(publishPromise).rejects.toThrow('SignalsPubSub is closed');
    expect(mocks.instances).toHaveLength(0);
    expect(pubsub.getSocket(topic)).toBeUndefined();
  });

  it('routes non-signal topics through Unix sockets', async () => {
    const { createSignalsPubSub } = await import('../signals-pubsub.js');
    const resourceId = '11111111-1111-4111-8111-111111111111';

    const pubsub = createSignalsPubSub(resourceId);
    await pubsub.publish('workflows', event);
    await pubsub.publish('workflows-finish', event);

    // Non-signal topics should create Unix sockets (no in-memory fallback)
    expect(mocks.instances).toHaveLength(2);
    expect(mocks.instances[0]?.socketPath).toBe(`/tmp/mc/${resourceId}/workflows.sock`);
    expect(mocks.instances[1]?.socketPath).toBe(`/tmp/mc/${resourceId}/workflows-finish.sock`);
  });

  it('hashes long socket paths that would exceed macOS sun_path limit', async () => {
    const { createSignalsPubSub } = await import('../signals-pubsub.js');
    const resourceId = '11111111-1111-4111-8111-111111111111';
    // Simulate a scheduler-generated runId that produces a path > 104 bytes
    const longTopic = 'workflow_events_v2_sched_wf___mastra_notification_dispatcher__dispatch_1781048760000';

    const pubsub = createSignalsPubSub(resourceId);
    await pubsub.publish(longTopic, event);

    expect(mocks.instances).toHaveLength(1);
    const socketPath = mocks.instances[0]?.socketPath;
    // The full path must be ≤ 104 bytes (macOS sun_path limit)
    expect(Buffer.byteLength(socketPath!)).toBeLessThanOrEqual(104);
    // Should use a hash-based filename instead of the raw topic
    expect(socketPath).toMatch(/\/tmp\/mc\/[^/]+\/[a-f0-9]{16}\.sock$/);
  });
});
