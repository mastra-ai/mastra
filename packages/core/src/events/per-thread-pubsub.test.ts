import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { PerThreadPubSub } from './per-thread-pubsub';
import type { Event } from './types';
import { UnixSocketPubSub } from './unix-socket-pubsub';

function makeEvent(overrides: Partial<Omit<Event, 'id' | 'createdAt'>> = {}): Omit<Event, 'id' | 'createdAt'> {
  return {
    type: 'test',
    data: {},
    runId: 'run-1',
    ...overrides,
  };
}

async function waitFor(assertion: () => void, timeoutMs = 2000): Promise<void> {
  const start = Date.now();
  let lastError: unknown;
  while (Date.now() - start < timeoutMs) {
    try {
      assertion();
      return;
    } catch (error) {
      lastError = error;
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }
  throw lastError;
}

describe('PerThreadPubSub', () => {
  const pubsubs: PerThreadPubSub[] = [];

  afterEach(async () => {
    await Promise.allSettled(pubsubs.splice(0).map(p => p.close()));
  });

  it('isolates events between different topics (threads)', async () => {
    const ps1 = new PerThreadPubSub('resource-1');
    const ps2 = new PerThreadPubSub('resource-1');
    pubsubs.push(ps1, ps2);

    const cb1 = vi.fn();
    const cb2 = vi.fn();

    await ps1.subscribe('thread-A', cb1);
    await ps2.subscribe('thread-B', cb2);

    await ps1.publish('thread-A', makeEvent({ type: 'for-A' }));
    await ps2.publish('thread-B', makeEvent({ type: 'for-B' }));

    await waitFor(() => {
      expect(cb1).toHaveBeenCalledTimes(1);
      expect(cb2).toHaveBeenCalledTimes(1);
    });

    // Verify isolation: thread-A event only goes to thread-A subscriber
    expect(cb1.mock.calls[0]![0].type).toBe('for-A');
    expect(cb2.mock.calls[0]![0].type).toBe('for-B');
  });

  it('delivers events between two instances on the same topic (thread)', async () => {
    const ps1 = new PerThreadPubSub('resource-1');
    const ps2 = new PerThreadPubSub('resource-1');
    pubsubs.push(ps1, ps2);

    const cb1 = vi.fn();
    const cb2 = vi.fn();

    await ps1.subscribe('thread-shared', cb1);
    await ps2.subscribe('thread-shared', cb2);

    await ps1.publish('thread-shared', makeEvent({ type: 'shared-event' }));

    await waitFor(() => {
      expect(cb1).toHaveBeenCalledTimes(1);
      expect(cb2).toHaveBeenCalledTimes(1);
    });
    expect(cb2.mock.calls[0]![0].type).toBe('shared-event');
  });

  it('solo instance does not serialize (broker has 0 clients)', async () => {
    const ps = new PerThreadPubSub('resource-solo');
    pubsubs.push(ps);

    const cb = vi.fn();
    await ps.subscribe('thread-solo', cb);
    await ps.publish('thread-solo', makeEvent({ type: 'solo-event' }));

    // Event is delivered locally
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb.mock.calls[0]![0].type).toBe('solo-event');

    // The underlying socket should be a broker with 0 remote clients
    const socket = ps.getSocket('thread-solo');
    expect(socket).toBeDefined();
    expect(socket!.isBroker).toBe(true);
    expect(socket!.remoteClientCount).toBe(0);
  });

  it('broker reports correct remoteClientCount when peers connect', async () => {
    const ps1 = new PerThreadPubSub('resource-peer');
    const ps2 = new PerThreadPubSub('resource-peer');
    pubsubs.push(ps1, ps2);

    await ps1.subscribe('thread-peer', vi.fn());
    await ps2.subscribe('thread-peer', vi.fn());

    const brokerSocket = ps1.getSocket('thread-peer');
    expect(brokerSocket).toBeDefined();
    expect(brokerSocket!.isBroker).toBe(true);
    expect(brokerSocket!.remoteClientCount).toBe(1);
  });

  it('client receives its own published events via broker echo', async () => {
    const ps1 = new PerThreadPubSub('resource-echo');
    const ps2 = new PerThreadPubSub('resource-echo');
    pubsubs.push(ps1, ps2);

    const cb1 = vi.fn();
    const cb2 = vi.fn();

    await ps1.subscribe('thread-echo', cb1);
    await ps2.subscribe('thread-echo', cb2);

    // ps2 publishes — both should receive the event (ps1 via broker forward,
    // ps2 via broker echo for local delivery)
    await ps2.publish('thread-echo', makeEvent({ type: 'from-ps2' }));

    await waitFor(() => {
      expect(cb1).toHaveBeenCalledTimes(1);
      expect(cb2).toHaveBeenCalledTimes(1);
    });
    expect(cb1.mock.calls[0]![0].type).toBe('from-ps2');
    expect(cb2.mock.calls[0]![0].type).toBe('from-ps2');
  });

  it('close() cleans up all per-thread sockets', async () => {
    const ps = new PerThreadPubSub('resource-close');
    pubsubs.push(ps);

    await ps.subscribe('thread-1', vi.fn());
    await ps.subscribe('thread-2', vi.fn());

    expect(ps.getSocket('thread-1')).toBeDefined();
    expect(ps.getSocket('thread-2')).toBeDefined();

    await ps.close();

    expect(ps.getSocket('thread-1')).toBeUndefined();
    expect(ps.getSocket('thread-2')).toBeUndefined();
  });
});

describe('UnixSocketPubSub - skip serialization when solo', () => {
  const pubsubs: UnixSocketPubSub[] = [];
  let tempDir: string | undefined;

  async function socketPath(name = 'events.sock') {
    tempDir ??= await mkdtemp(join(tmpdir(), 'mastra-uds-solo-'));
    return join(tempDir, name);
  }

  afterEach(async () => {
    await Promise.allSettled(pubsubs.splice(0).map(p => p.close()));
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
      tempDir = undefined;
    }
  });

  it('broker delivers events locally when no remote clients exist', async () => {
    const path = await socketPath();
    const broker = new UnixSocketPubSub(path);
    pubsubs.push(broker);

    const cb = vi.fn();
    await broker.subscribe('topic-a', cb);
    await broker.publish('topic-a', makeEvent({ type: 'solo' }));

    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb.mock.calls[0]![0].type).toBe('solo');
    expect(broker.remoteClientCount).toBe(0);
  });

  it('client receives its own event via broker echo for local delivery', async () => {
    const path = await socketPath();
    const broker = new UnixSocketPubSub(path);
    const client = new UnixSocketPubSub(path);
    pubsubs.push(broker, client);

    const brokerCb = vi.fn();
    const clientCb = vi.fn();

    await broker.subscribe('topic-a', brokerCb);
    await client.subscribe('topic-a', clientCb);

    // Client publishes — both receive: broker via local delivery, client via broker echo
    await client.publish('topic-a', makeEvent({ type: 'from-client' }));

    await waitFor(() => {
      expect(brokerCb).toHaveBeenCalledTimes(1);
      expect(clientCb).toHaveBeenCalledTimes(1);
    });
    expect(brokerCb.mock.calls[0]![0].type).toBe('from-client');
    expect(clientCb.mock.calls[0]![0].type).toBe('from-client');
  });

  it('broker forwards to all subscribed clients including the publisher', async () => {
    const path = await socketPath();
    const broker = new UnixSocketPubSub(path);
    const clientA = new UnixSocketPubSub(path);
    const clientB = new UnixSocketPubSub(path);
    pubsubs.push(broker, clientA, clientB);

    const brokerCb = vi.fn();
    const clientACb = vi.fn();
    const clientBCb = vi.fn();

    await broker.subscribe('topic-a', brokerCb);
    await clientA.subscribe('topic-a', clientACb);
    await clientB.subscribe('topic-a', clientBCb);

    // clientA publishes — all three should receive it
    await clientA.publish('topic-a', makeEvent({ type: 'from-A' }));

    await waitFor(() => {
      expect(brokerCb).toHaveBeenCalledTimes(1);
      expect(clientACb).toHaveBeenCalledTimes(1);
      expect(clientBCb).toHaveBeenCalledTimes(1);
    });
    expect(brokerCb.mock.calls[0]![0].type).toBe('from-A');
    expect(clientBCb.mock.calls[0]![0].type).toBe('from-A');
  });
});
