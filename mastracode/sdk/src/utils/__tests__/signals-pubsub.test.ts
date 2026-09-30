import { describe, it, expect, beforeEach, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const instances: MockUnixSocketPubSub[] = [];
  let mkdirImpl: () => Promise<void> = async () => {};
  let publishImpl: () => Promise<void> = async () => {};
  let closeImpl: () => Promise<void> = async () => {};

  class MockPubSub {
    clearTopic(): Promise<void> {
      return Promise.resolve();
    }
  }

  class MockUnixSocketPubSub {
    readonly socketPath: string;
    readonly published: Array<{ topic: string; event: unknown }> = [];
    readonly subscriptions: string[] = [];
    readonly leaseKeys: string[] = [];
    readonly unsubscriptions: string[] = [];
    closed = false;

    async acquireLease(key: string): Promise<boolean> {
      this.leaseKeys.push(key);
      return true;
    }

    async getLeaseOwner(key: string): Promise<string | undefined> {
      this.leaseKeys.push(key);
      return undefined;
    }

    async releaseLease(key: string): Promise<void> {
      this.leaseKeys.push(key);
    }

    async renewLease(key: string): Promise<boolean> {
      this.leaseKeys.push(key);
      return true;
    }

    async transferLease(key: string): Promise<boolean> {
      this.leaseKeys.push(key);
      return true;
    }

    constructor(socketPath: string) {
      this.socketPath = socketPath;
      instances.push(this);
    }

    async publish(topic: string, event: unknown): Promise<void> {
      await publishImpl();
      this.published.push({ topic, event });
    }

    async subscribe(topic: string): Promise<void> {
      this.subscriptions.push(topic);
    }

    async unsubscribe(topic: string): Promise<void> {
      this.unsubscriptions.push(topic);
    }

    async flush(): Promise<void> {}

    async close(): Promise<void> {
      this.closed = true;
      await closeImpl();
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
    setPublishImpl: (impl: () => Promise<void>) => {
      publishImpl = impl;
    },
    setCloseImpl: (impl: () => Promise<void>) => {
      closeImpl = impl;
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

const findSocket = (socketPath: string) => mocks.instances.find(instance => instance.socketPath === socketPath);

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
    mocks.setPublishImpl(async () => {});
    mocks.setCloseImpl(async () => {});
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
    expect(findSocket(`/tmp/mc/${resourceId}/${threadId}.sock`)).toBeDefined();
  });

  it('falls back to a sanitized topic when thread-stream decoding fails', async () => {
    const { createSignalsPubSub } = await import('../signals-pubsub.js');
    const resourceId = '11111111-1111-4111-8111-111111111111';
    const topic = 'agent.thread-stream.%E0%A4%A';

    const pubsub = createSignalsPubSub(resourceId);
    await expect(pubsub.publish(topic, event)).resolves.toBeUndefined();

    expect(findSocket(`/tmp/mc/${resourceId}/agent_thread-stream__E0_A4_A.sock`)).toBeDefined();
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
    expect(findSocket(`/tmp/mc/${resourceId}/${threadId}.sock`)).toBeUndefined();

    mkdir.resolve();
    await Promise.all([publishPromise, subscribePromise]);

    const topicSocket = findSocket(`/tmp/mc/${resourceId}/${threadId}.sock`);
    expect(topicSocket?.published).toHaveLength(1);
    expect(topicSocket?.subscriptions).toEqual([topic]);
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
    expect(findSocket(`/tmp/mc/${resourceId}/${threadId}.sock`)).toBeUndefined();
    expect(findSocket(`/tmp/mc/${resourceId}/.leases.sock`)?.closed).toBe(true);
    expect(pubsub.getSocket(topic)).toBeUndefined();
  });

  it('holds non-thread leases in its own resource directory and closes the lease sockets', async () => {
    const { createSignalsPubSub } = await import('../signals-pubsub.js');
    const resourceId = '11111111-1111-4111-8111-111111111111';
    const leasePath = `/tmp/mc/${resourceId}/.leases.sock`;

    const pubsub = createSignalsPubSub(resourceId);
    const leaseProvider = pubsub.getLeaseProvider();
    expect(findSocket(leasePath)).toBeDefined();

    await leaseProvider.acquireLease('schedule:abc', 'owner', 1000);
    expect(findSocket(leasePath)?.leaseKeys).toEqual(['schedule:abc']);

    await pubsub.close();
    expect(findSocket(leasePath)?.closed).toBe(true);
  });

  it("holds a thread's run and claim leases in the thread's resource directory, whichever project asks", async () => {
    const { createSignalsPubSub } = await import('../signals-pubsub.js');
    const ownResource = 'mastra-bbb';
    const threadResource = 'sentinel-aaa';
    const threadKey = `${threadResource}\0thread-1`;

    const pubsub = createSignalsPubSub(ownResource);
    const leases = pubsub.getLeaseProvider();
    await leases.acquireLease(threadKey, 'run-1', 1000);
    await leases.getLeaseOwner(`thread-claim:${threadKey}`);
    await leases.renewLease(threadKey, 'run-1', 1000);
    await leases.transferLease(threadKey, 'run-1', 'run-2', 1000);
    await leases.releaseLease(threadKey, 'run-2');

    expect(findSocket(`/tmp/mc/${threadResource}/.leases.sock`)?.leaseKeys).toEqual([
      threadKey,
      `thread-claim:${threadKey}`,
      threadKey,
      threadKey,
      threadKey,
    ]);
    expect(findSocket(`/tmp/mc/${ownResource}/.leases.sock`)?.leaseKeys).toEqual([]);

    await pubsub.close();
    expect(findSocket(`/tmp/mc/${threadResource}/.leases.sock`)?.closed).toBe(true);
  });

  it("holds a resource's notification dispatch lease in that resource's directory", async () => {
    const { createSignalsPubSub, notificationDispatchLeaseKey } = await import('../signals-pubsub.js');
    const pubsub = createSignalsPubSub('mastra-bbb');

    await pubsub.getLeaseProvider().acquireLease(notificationDispatchLeaseKey('sentinel-aaa'), 'owner', 1000);
    await pubsub.getLeaseProvider().acquireLease(notificationDispatchLeaseKey('../escape'), 'owner', 1000);

    expect(findSocket('/tmp/mc/sentinel-aaa/.leases.sock')?.leaseKeys).toEqual(['notification-dispatch:sentinel-aaa']);
    expect(findSocket('/tmp/mc/mastra-bbb/.leases.sock')?.leaseKeys).toEqual(['notification-dispatch:../escape']);
  });

  it("routes another resource's thread stream to that resource's directory", async () => {
    const { createSignalsPubSub } = await import('../signals-pubsub.js');
    const pubsub = createSignalsPubSub('mastra-bbb');

    await pubsub.publish(threadTopic('sentinel-aaa', 'thread-1'), event);
    await pubsub.publish(`${threadTopic('sentinel-aaa', 'thread-1')}.idle-acceptance.req-1`, event);

    expect(findSocket('/tmp/mc/sentinel-aaa/thread-1.sock')).toBeDefined();
    expect(findSocket('/tmp/mc/sentinel-aaa/thread-1.idle-acceptance.req-1.sock')).toBeDefined();
  });

  it('routes thread-owner discovery to the shared directory and keeps peer discovery per project', async () => {
    const { createSignalsPubSub } = await import('../signals-pubsub.js');
    const pubsub = createSignalsPubSub('mastra-bbb');

    await pubsub.publish('agent.thread-owner-discovery', event);
    await pubsub.publish('agent.thread-owner-discovery.req-1', event);
    await pubsub.publish('agent.thread-peer-discovery', event);

    expect(findSocket('/tmp/mc/_shared/agent_thread-owner-discovery.sock')).toBeDefined();
    expect(findSocket('/tmp/mc/_shared/agent_thread-owner-discovery_req-1.sock')).toBeDefined();
    expect(findSocket('/tmp/mc/mastra-bbb/agent_thread-peer-discovery.sock')).toBeDefined();
  });

  it('keeps a thread topic in its own directory when the resource id cannot name a directory', async () => {
    const { createSignalsPubSub } = await import('../signals-pubsub.js');
    const pubsub = createSignalsPubSub('mastra-bbb');

    await pubsub.publish(threadTopic('../escape', 'thread-1'), event);
    await pubsub.getLeaseProvider().acquireLease('../escape\0thread-1', 'run-1', 1000);

    expect(findSocket('/tmp/mc/mastra-bbb/thread-1.sock')).toBeDefined();
    expect(findSocket('/tmp/mc/mastra-bbb/.leases.sock')?.leaseKeys).toEqual(['../escape\0thread-1']);
    expect(mocks.instances.some(instance => instance.socketPath.includes('escape'))).toBe(false);
  });

  it('routes non-signal topics through Unix sockets', async () => {
    const { createSignalsPubSub } = await import('../signals-pubsub.js');
    const resourceId = '11111111-1111-4111-8111-111111111111';

    const pubsub = createSignalsPubSub(resourceId);
    await pubsub.publish('workflows', event);
    await pubsub.publish('workflows-finish', event);

    // Non-signal topics should create Unix sockets (no in-memory fallback)
    expect(findSocket(`/tmp/mc/${resourceId}/workflows.sock`)).toBeDefined();
    expect(findSocket(`/tmp/mc/${resourceId}/workflows-finish.sock`)).toBeDefined();
  });

  it('hashes long socket paths that would exceed macOS sun_path limit', async () => {
    const { createSignalsPubSub } = await import('../signals-pubsub.js');
    const resourceId = '11111111-1111-4111-8111-111111111111';
    // Simulate a scheduler-generated runId that produces a path > 104 bytes
    const longTopic = 'workflow_events_v2_sched_wf___mastra_notification_dispatcher__dispatch_1781048760000';

    const pubsub = createSignalsPubSub(resourceId);
    await pubsub.publish(longTopic, event);

    const socketPath = mocks.instances.find(
      instance => instance.socketPath !== `/tmp/mc/${resourceId}/.leases.sock`,
    )?.socketPath;
    // The full path must be ≤ 104 bytes (macOS sun_path limit)
    expect(Buffer.byteLength(socketPath!)).toBeLessThanOrEqual(104);
    // Should use a hash-based filename instead of the raw topic
    expect(socketPath).toMatch(/\/tmp\/mc\/[^/]+\/[a-f0-9]{16}\.sock$/);
  });

  describe('one-shot reply topics', () => {
    // Short enough that reply socket paths stay under the 104-byte limit and keep readable names.
    const resourceId = 'res-a';
    const requestId = '33333333-3333-4333-8333-333333333333';
    const peerReplyTopic = `agent.thread-peer-discovery.${requestId}`;
    const ownerReplyTopic = `agent.thread-owner-discovery.${requestId}`;

    it('closes a requester reply socket once it is unsubscribed and cleared', async () => {
      const { createSignalsPubSub } = await import('../signals-pubsub.js');
      const pubsub = createSignalsPubSub(resourceId);
      const cb = vi.fn();

      await pubsub.subscribe(peerReplyTopic, cb);
      const socket = pubsub.getSocket(peerReplyTopic);
      expect(socket).toBeDefined();

      await pubsub.unsubscribe(peerReplyTopic, cb);
      await pubsub.clearTopic(peerReplyTopic);

      expect(pubsub.getSocket(peerReplyTopic)).toBeUndefined();
      expect(findSocket(`/tmp/mc/${resourceId}/agent_thread-peer-discovery_${requestId}.sock`)?.closed).toBe(true);
    });

    it('does not retain a responder reply socket after its publish settles', async () => {
      const { createSignalsPubSub } = await import('../signals-pubsub.js');
      const pubsub = createSignalsPubSub(resourceId);

      await pubsub.publish(ownerReplyTopic, event);

      expect(pubsub.getSocket(ownerReplyTopic)).toBeUndefined();
      const socket = findSocket(`/tmp/mc/_shared/agent_thread-owner-discovery_${requestId}.sock`);
      expect(socket?.published).toHaveLength(1);
      expect(socket?.closed).toBe(true);
    });

    it('closes idle-acceptance reply sockets after their publish settles', async () => {
      const { createSignalsPubSub } = await import('../signals-pubsub.js');
      const pubsub = createSignalsPubSub(resourceId);
      const topic = `${threadTopic(resourceId, 'thread-a')}.idle-acceptance.${requestId}`;

      await pubsub.publish(topic, event);

      expect(pubsub.getSocket(topic)).toBeUndefined();
      expect(mocks.instances.find(instance => instance.published.length === 1)?.closed).toBe(true);
    });

    it('delivers concurrent publishes on one reply topic before closing it', async () => {
      const gate = deferred();
      mocks.setPublishImpl(() => gate.promise);
      const { createSignalsPubSub } = await import('../signals-pubsub.js');
      const pubsub = createSignalsPubSub(resourceId);
      const cb = vi.fn();
      await pubsub.subscribe(peerReplyTopic, cb);
      const socket = findSocket(`/tmp/mc/${resourceId}/agent_thread-peer-discovery_${requestId}.sock`)!;

      const first = pubsub.publish(peerReplyTopic, event);
      const second = pubsub.publish(peerReplyTopic, event);
      gate.resolve();
      await Promise.all([first, second]);

      expect(socket.published).toHaveLength(2);
      expect(socket.closed).toBe(false);
      expect(pubsub.getSocket(peerReplyTopic)).toBe(socket);

      await pubsub.unsubscribe(peerReplyTopic, cb);
      await pubsub.clearTopic(peerReplyTopic);
      expect(socket.closed).toBe(true);
    });

    it('keeps a responder reply socket open until every concurrent publish settles', async () => {
      const gates = [deferred(), deferred()];
      let calls = 0;
      mocks.setPublishImpl(() => gates[calls++]!.promise);
      const { createSignalsPubSub } = await import('../signals-pubsub.js');
      const pubsub = createSignalsPubSub(resourceId);

      const first = pubsub.publish(ownerReplyTopic, event);
      const second = pubsub.publish(ownerReplyTopic, event);
      await new Promise(resolve => setTimeout(resolve, 0));
      const socket = pubsub.getSocket(ownerReplyTopic)!;

      gates[0]!.resolve();
      await first;
      expect(socket.closed).toBe(false);

      gates[1]!.resolve();
      await second;
      expect(socket.published).toHaveLength(2);
      expect(socket.closed).toBe(true);
      expect(mocks.instances.filter(instance => instance.socketPath === socket.socketPath)).toHaveLength(1);
    });

    it('does not close long-lived topics on clearTopic', async () => {
      const { createSignalsPubSub } = await import('../signals-pubsub.js');
      const pubsub = createSignalsPubSub(resourceId);
      const workflowTopic = 'workflow.events.v2.run-1';
      const streamTopic = threadTopic(resourceId, 'thread-a');
      await pubsub.subscribe(workflowTopic, vi.fn());
      await pubsub.subscribe(streamTopic, vi.fn());

      await pubsub.clearTopic(workflowTopic);
      await pubsub.clearTopic(streamTopic);

      expect(pubsub.getSocket(workflowTopic)?.closed).toBe(false);
      expect(pubsub.getSocket(streamTopic)?.closed).toBe(false);
    });

    it('gives a publish that races a close a fresh socket', async () => {
      const closeGate = deferred();
      mocks.setCloseImpl(() => closeGate.promise);
      const { createSignalsPubSub } = await import('../signals-pubsub.js');
      const pubsub = createSignalsPubSub(resourceId);

      await pubsub.publish(ownerReplyTopic, event);
      const closing = mocks.instances.find(instance => instance.published.length === 1)!;
      expect(closing.closed).toBe(true);

      const second = pubsub.publish(ownerReplyTopic, event);
      await new Promise(resolve => setTimeout(resolve, 0));
      closeGate.resolve();
      await second;

      const sockets = mocks.instances.filter(instance => instance.socketPath === closing.socketPath);
      expect(sockets).toHaveLength(2);
      expect(closing.published).toHaveLength(1);
      expect(sockets[1]!.published).toHaveLength(1);
    });

    it('leaves nothing behind when clearTopic races an in-flight subscribe', async () => {
      const mkdir = deferred();
      mocks.setMkdirImpl(() => mkdir.promise);
      const { createSignalsPubSub } = await import('../signals-pubsub.js');
      const pubsub = createSignalsPubSub(resourceId);
      const cb = vi.fn();

      const subscribing = pubsub.subscribe(peerReplyTopic, cb);
      await Promise.resolve();
      await pubsub.clearTopic(peerReplyTopic);
      mkdir.resolve();
      await expect(subscribing).resolves.toBeUndefined();

      expect(pubsub.getSocket(peerReplyTopic)).toBeUndefined();
      const socket = findSocket(`/tmp/mc/${resourceId}/agent_thread-peer-discovery_${requestId}.sock`);
      expect(socket?.closed).toBe(true);
    });
  });
});
