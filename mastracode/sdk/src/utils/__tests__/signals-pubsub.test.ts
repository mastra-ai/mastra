import { mkdtempSync, rmSync } from 'node:fs';

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const instances: MockUnixSocketPubSub[] = [];
  let mkdirImpl: (dir: string) => Promise<void> = async () => {};
  let publishImpl: () => Promise<void> = async () => {};
  let closeImpl: () => Promise<void> = async () => {};
  let subscribeImpl: (socketPath: string) => Promise<void> = async () => {};

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
    readonly callbacks = new Set<(event: unknown) => void>();
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

    // Like core: the callback is registered before the socket starts and
    // removed again if starting fails.
    async subscribe(topic: string, cb?: (event: unknown) => void): Promise<void> {
      this.subscriptions.push(topic);
      if (cb) this.callbacks.add(cb);
      try {
        await subscribeImpl(this.socketPath);
      } catch (error) {
        if (cb) this.callbacks.delete(cb);
        throw error;
      }
    }

    async unsubscribe(topic: string, cb?: (event: unknown) => void): Promise<void> {
      this.unsubscriptions.push(topic);
      if (cb) this.callbacks.delete(cb);
    }

    /** Simulates the broker delivering an event to this socket's subscribers. */
    deliver(event: unknown): void {
      for (const cb of this.callbacks) cb(event);
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
    mkdir: vi.fn((dir: string) => mkdirImpl(dir)),
    setMkdirImpl: (impl: (dir: string) => Promise<void>) => {
      mkdirImpl = impl;
    },
    setPublishImpl: (impl: () => Promise<void>) => {
      publishImpl = impl;
    },
    setCloseImpl: (impl: () => Promise<void>) => {
      closeImpl = impl;
    },
    setSubscribeImpl: (impl: (socketPath: string) => Promise<void>) => {
      subscribeImpl = impl;
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
    mocks.setSubscribeImpl(async () => {});
    // Tests assume the default socket root.
    vi.stubEnv('MASTRACODE_SIGNALS_SOCKET_ROOT', '');
    vi.resetModules();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
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

  it('rejects lease calls after close instead of reopening a lease socket', async () => {
    const { createSignalsPubSub } = await import('../signals-pubsub.js');
    const pubsub = createSignalsPubSub('mastra-bbb');
    const leases = pubsub.getLeaseProvider();
    await pubsub.close();

    await expect(leases.renewLease('sentinel-aaa\0thread-1', 'run-1', 1000)).rejects.toThrow('SignalsPubSub is closed');
    await expect(leases.getLeaseOwner('schedule:abc')).rejects.toThrow('SignalsPubSub is closed');

    expect(mocks.instances.map(instance => instance.socketPath)).toEqual(['/tmp/mc/mastra-bbb/.leases.sock']);
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

  describe('shared agent discovery', () => {
    const resourceId = 'res-a';
    const foreignResourceId = 'res-b';
    const requestId = '44444444-4444-4444-8444-444444444444';
    const peerRequestTopic = 'agent.thread-peer-discovery';
    const ownerRequestTopic = 'agent.thread-owner-discovery';
    const peerReplyTopic = `${peerRequestTopic}.${requestId}`;
    let root: string;

    beforeEach(() => {
      // Short root: macOS limits socket paths to 104 bytes.
      root = mkdtempSync('/tmp/mcs-');
    });

    afterEach(() => {
      vi.restoreAllMocks();
      rmSync(root, { recursive: true, force: true });
    });

    const socketPaths = () => mocks.instances.map(instance => instance.socketPath);

    it('keeps peer discovery in the resource directory when shared discovery is off', async () => {
      const { createSignalsPubSub } = await import('../signals-pubsub.js');
      const pubsub = createSignalsPubSub(resourceId, { sharedAgentDiscovery: false, rootDir: root });

      await pubsub.subscribe(peerRequestTopic, vi.fn());
      await pubsub.publish(peerReplyTopic, event);

      expect(socketPaths()).toEqual([
        `${root}/${resourceId}/.leases.sock`,
        `${root}/${resourceId}/agent_thread-peer-discovery.sock`,
        `${root}/${resourceId}/agent_thread-peer-discovery_${requestId}.sock`,
      ]);
    });

    it("keeps another resource's thread socket open, as before, when shared discovery is off", async () => {
      const { createSignalsPubSub } = await import('../signals-pubsub.js');
      const pubsub = createSignalsPubSub(resourceId, { rootDir: root });

      await pubsub.publish(threadTopic(foreignResourceId, 'thread-b'), event);

      expect(findSocket(`${root}/${foreignResourceId}/thread-b.sock`)?.closed).toBe(false);
    });

    it('leaves thread-owner discovery in the shared directory only', async () => {
      const { createSignalsPubSub } = await import('../signals-pubsub.js');
      const pubsub = createSignalsPubSub(resourceId, { sharedAgentDiscovery: true, rootDir: root });

      await pubsub.subscribe(ownerRequestTopic, vi.fn());
      await pubsub.publish(ownerRequestTopic, event);

      expect(socketPaths().filter(path => path.includes('owner-discovery'))).toEqual([
        `${root}/_shared/agent_thread-owner-discovery.sock`,
      ]);
    });

    it('subscribes, publishes and unsubscribes peer discovery requests in the shared directory only', async () => {
      const { createSignalsPubSub } = await import('../signals-pubsub.js');
      const pubsub = createSignalsPubSub(resourceId, { sharedAgentDiscovery: true, rootDir: root });
      const cb = vi.fn();

      await pubsub.subscribe(peerRequestTopic, cb);
      await pubsub.publish(peerRequestTopic, event);
      const shared = findSocket(`${root}/_shared/agent_thread-peer-discovery.sock`)!;

      expect(socketPaths().filter(path => path.includes('peer-discovery'))).toEqual([
        `${root}/_shared/agent_thread-peer-discovery.sock`,
      ]);
      expect(shared.subscriptions).toEqual([peerRequestTopic]);
      expect(shared.published).toHaveLength(1);

      await pubsub.unsubscribe(peerRequestTopic, cb);
      expect(shared.callbacks.size).toBe(0);
    });

    it('listens for and publishes discovery replies in the shared directory, and closes them after use', async () => {
      const { createSignalsPubSub } = await import('../signals-pubsub.js');
      const pubsub = createSignalsPubSub(resourceId, { sharedAgentDiscovery: true, rootDir: root });
      const cb = vi.fn();

      await pubsub.subscribe(peerReplyTopic, cb);
      const listening = findSocket(`${root}/_shared/agent_thread-peer-discovery_${requestId}.sock`)!;
      listening.deliver(event);
      expect(cb).toHaveBeenCalledTimes(1);
      await pubsub.unsubscribe(peerReplyTopic, cb);
      await pubsub.clearTopic(peerReplyTopic);
      expect(listening.closed).toBe(true);

      await pubsub.publish(peerReplyTopic, event);
      const replies = mocks.instances.filter(instance => instance.socketPath.includes(requestId));
      expect(new Set(replies.map(instance => instance.socketPath))).toEqual(
        new Set([`${root}/_shared/agent_thread-peer-discovery_${requestId}.sock`]),
      );
      expect(replies.every(instance => instance.closed)).toBe(true);
    });

    it("routes another resource's thread topic to that resource's directory and closes it after use", async () => {
      const { createSignalsPubSub } = await import('../signals-pubsub.js');
      const pubsub = createSignalsPubSub(resourceId, { sharedAgentDiscovery: true, rootDir: root });
      const topic = threadTopic(foreignResourceId, 'thread-b');

      await pubsub.publish(topic, event);

      const socket = findSocket(`${root}/${foreignResourceId}/thread-b.sock`);
      expect(socket?.published).toHaveLength(1);
      expect(socket?.closed).toBe(true);
      expect(pubsub.getSocket(topic)).toBeUndefined();
    });

    it("routes another resource's idle-acceptance replies to that resource's directory", async () => {
      const { createSignalsPubSub } = await import('../signals-pubsub.js');
      const pubsub = createSignalsPubSub(resourceId, { sharedAgentDiscovery: true, rootDir: root });
      const topic = `${threadTopic(foreignResourceId, 'b')}.idle-acceptance.${requestId}`;
      const cb = vi.fn();

      await pubsub.subscribe(topic, cb);
      const socket = findSocket(`${root}/${foreignResourceId}/b.idle-acceptance.${requestId}.sock`)!;
      expect(socket.subscriptions).toEqual([topic]);

      await pubsub.unsubscribe(topic, cb);
      await pubsub.clearTopic(topic);
      expect(socket.closed).toBe(true);
    });

    it('keeps own-resource thread topics on their usual long-lived path', async () => {
      const { createSignalsPubSub } = await import('../signals-pubsub.js');
      const ownResource = 'resource:a';
      const pubsub = createSignalsPubSub(ownResource, { sharedAgentDiscovery: true, rootDir: root });

      await pubsub.publish(threadTopic(ownResource, 'thread-1'), event);
      await pubsub.publish(threadTopic('', 'thread-2'), event);

      expect(findSocket(`${root}/${ownResource}/thread-1.sock`)?.closed).toBe(false);
      expect(findSocket(`${root}/${ownResource}/thread-2.sock`)?.closed).toBe(false);
    });

    it('rejects a foreign threadId that is not a safe file name and creates nothing', async () => {
      const { createSignalsPubSub } = await import('../signals-pubsub.js');
      const pubsub = createSignalsPubSub(resourceId, { sharedAgentDiscovery: true, rootDir: root });

      for (const threadId of ['../evil', 'a/b', 'a\\b', '..', 'x\u0001']) {
        await expect(pubsub.publish(threadTopic(foreignResourceId, threadId), event)).rejects.toThrow(
          /threadId is not a safe file name/,
        );
        await expect(pubsub.subscribe(threadTopic(foreignResourceId, threadId), vi.fn())).rejects.toThrow(
          /threadId is not a safe file name/,
        );
      }

      expect(socketPaths().filter(path => !path.endsWith('.leases.sock'))).toEqual([]);
      expect(mocks.mkdir).not.toHaveBeenCalled();
    });

    it('keeps a thread whose resourceId is not a safe directory name on the resource-local path', async () => {
      const { createSignalsPubSub } = await import('../signals-pubsub.js');
      const pubsub = createSignalsPubSub(resourceId, { sharedAgentDiscovery: true, rootDir: root });

      for (const hostile of ['../evil', 'a/b', 'a\\b', '..', 'x\u0001', 'r'.repeat(129)]) {
        await pubsub.publish(threadTopic(hostile, 'thread-x'), event);
      }

      expect(new Set(socketPaths().filter(path => !path.endsWith('.leases.sock')))).toEqual(
        new Set([`${root}/${resourceId}/thread-x.sock`]),
      );
      expect(mocks.mkdir.mock.calls.every(([dir]) => dir === `${root}/${resourceId}`)).toBe(true);
    });

    it('ignores a relative MASTRACODE_SIGNALS_SOCKET_ROOT', async () => {
      vi.stubEnv('MASTRACODE_SIGNALS_SOCKET_ROOT', 'relative/root');
      const { createSignalsPubSub } = await import('../signals-pubsub.js');
      const pubsub = createSignalsPubSub(resourceId);

      await pubsub.publish('workflows', event);

      expect(socketPaths()).toEqual([`/tmp/mc/${resourceId}/.leases.sock`, `/tmp/mc/${resourceId}/workflows.sock`]);
    });

    it("routes another resource's thread when its resourceId is an ordinary override such as resource:b", async () => {
      const { createSignalsPubSub } = await import('../signals-pubsub.js');
      const pubsub = createSignalsPubSub(resourceId, { sharedAgentDiscovery: true, rootDir: root });

      await pubsub.publish(threadTopic('resource:b', 'thread-b'), event);

      expect(findSocket(`${root}/resource:b/thread-b.sock`)?.published).toHaveLength(1);
    });

    it("keeps another resource's thread socket open while subscribed, even across clearTopic", async () => {
      const { createSignalsPubSub } = await import('../signals-pubsub.js');
      const pubsub = createSignalsPubSub(resourceId, { sharedAgentDiscovery: true, rootDir: root });
      const topic = threadTopic(foreignResourceId, 'thread-b');
      const cb = vi.fn();

      await pubsub.subscribe(topic, cb);
      for (let i = 0; i < 3; i++) await pubsub.publish(topic, event);
      await pubsub.clearTopic(topic);
      const socket = findSocket(`${root}/${foreignResourceId}/thread-b.sock`)!;
      expect(mocks.instances.filter(instance => instance === socket)).toHaveLength(1);
      expect(socket.published).toHaveLength(3);
      expect(socket.closed).toBe(false);

      await pubsub.unsubscribe(topic, cb);
      expect(socket.closed).toBe(true);
    });

    it('does not join the shared scope when its own resourceId cannot be a directory name', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { createSignalsPubSub } = await import('../signals-pubsub.js');
      const pubsub = createSignalsPubSub('team/a', { sharedAgentDiscovery: true, rootDir: root });

      await pubsub.subscribe(peerRequestTopic, vi.fn());

      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0]![0]).toMatch(/resource id "team\/a" cannot be used/);
      expect(socketPaths().some(path => path.includes('_shared'))).toBe(false);
    });

    it('fails a peer discovery subscribe when the shared directory is unavailable, so the claim is retried', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      mocks.setSubscribeImpl(async socketPath => {
        if (socketPath.startsWith(`${root}/_shared/`)) throw new Error('Stale broker election lock removed');
      });
      const { createSignalsPubSub } = await import('../signals-pubsub.js');
      const pubsub = createSignalsPubSub(resourceId, { sharedAgentDiscovery: true, rootDir: root });
      const cb = vi.fn();

      await expect(pubsub.subscribe(peerRequestTopic, cb)).rejects.toThrow(/Stale broker election lock removed/);

      expect(warn).not.toHaveBeenCalled();
      expect(findSocket(`${root}/_shared/agent_thread-peer-discovery.sock`)?.callbacks.has(cb)).toBe(false);
      expect(findSocket(`${root}/${resourceId}/agent_thread-peer-discovery.sock`)).toBeUndefined();
      await pubsub.close();
    });

    it('uses MASTRACODE_SIGNALS_SOCKET_ROOT when no rootDir is passed', async () => {
      vi.stubEnv('MASTRACODE_SIGNALS_SOCKET_ROOT', root);
      const { createSignalsPubSub } = await import('../signals-pubsub.js');
      const pubsub = createSignalsPubSub(resourceId);

      await pubsub.publish('workflows', event);

      expect(socketPaths()).toEqual([`${root}/${resourceId}/.leases.sock`, `${root}/${resourceId}/workflows.sock`]);
    });

    it('keeps lease and thread socket paths within the 104-byte limit for a short root', async () => {
      const { createSignalsPubSub } = await import('../signals-pubsub.js');
      const longResourceId = 'r'.repeat(64);
      const pubsub = createSignalsPubSub(longResourceId, { rootDir: root });

      await pubsub.publish(threadTopic(longResourceId, '22222222-2222-4222-8222-222222222222'), event);

      expect(socketPaths()).toHaveLength(2);
      for (const path of socketPaths()) expect(Buffer.byteLength(path)).toBeLessThanOrEqual(104);
    });
  });
});
