/**
 * Tests for UnixSocketPubSub lazy serialization / skip-when-solo behavior.
 */
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

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

  it('broker reports correct remoteClientCount when peers connect', async () => {
    const path = await socketPath();
    const broker = new UnixSocketPubSub(path);
    const client = new UnixSocketPubSub(path);
    pubsubs.push(broker, client);

    await broker.subscribe('topic-a', vi.fn());
    await client.subscribe('topic-a', vi.fn());

    expect(broker.isBroker).toBe(true);
    expect(broker.remoteClientCount).toBe(1);
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

    await clientA.publish('topic-a', makeEvent({ type: 'from-A' }));

    await waitFor(() => {
      expect(brokerCb).toHaveBeenCalledTimes(1);
      expect(clientACb).toHaveBeenCalledTimes(1);
      expect(clientBCb).toHaveBeenCalledTimes(1);
    });
    expect(brokerCb.mock.calls[0]![0].type).toBe('from-A');
    expect(clientBCb.mock.calls[0]![0].type).toBe('from-A');
  });

  it('elects a new broker and keeps subscriptions synced when the broker disconnects', async () => {
    const path = await socketPath();
    const broker = new UnixSocketPubSub(path);
    const clientA = new UnixSocketPubSub(path);
    const clientB = new UnixSocketPubSub(path);
    pubsubs.push(clientA, clientB);

    const clientACb = vi.fn();
    const clientBCb = vi.fn();

    await broker.subscribe('topic-a', vi.fn());
    await clientA.subscribe('topic-a', clientACb);
    await clientB.subscribe('topic-a', clientBCb);

    await broker.close();

    await waitFor(() => {
      const activePubsubs = [clientA, clientB];
      expect(activePubsubs.filter(pubsub => pubsub.isBroker)).toHaveLength(1);
      expect(activePubsubs.some(pubsub => !pubsub.isBroker)).toBe(true);
    });

    await clientA.publish('topic-a', makeEvent({ type: 'after-failover' }));

    await waitFor(() => {
      expect(clientACb).toHaveBeenCalledTimes(1);
      expect(clientBCb).toHaveBeenCalledTimes(1);
    });
    expect(clientACb.mock.calls[0]![0].type).toBe('after-failover');
    expect(clientBCb.mock.calls[0]![0].type).toBe('after-failover');
  });
});
