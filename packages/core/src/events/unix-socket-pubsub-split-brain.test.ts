import { mkdtemp, rm, unlink } from 'node:fs/promises';
import net from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Event } from './types';
import { UnixSocketPubSub } from './unix-socket-pubsub';

// Split-brain: two brokers serving the same socket path, each with its own set
// of clients, so a publisher in one group can never reach a subscriber in the
// other. These tests drive the ways a live broker's socket file can be
// replaced or removed and check that every instance ends up on one broker.

function makeEvent(type: string): Omit<Event, 'id' | 'createdAt'> {
  return { type, data: {}, runId: 'run-1' };
}

async function waitFor(assertion: () => void | Promise<void>, timeoutMs = 3000): Promise<void> {
  const start = Date.now();
  let lastError: unknown;
  while (Date.now() - start < timeoutMs) {
    try {
      await assertion();
      return;
    } catch (error) {
      lastError = error;
      await new Promise(resolve => setTimeout(resolve, 20));
    }
  }
  throw lastError;
}

/** Makes the next `count` connection attempts fail as if the broker refused them (a full backlog on a loaded host). */
function refuseNextConnects(count: number) {
  const original = net.createConnection;
  let remaining = count;
  return vi.spyOn(net, 'createConnection').mockImplementation(((...args: Parameters<typeof net.createConnection>) => {
    if (remaining <= 0) return original(...args);
    remaining--;
    const socket = new net.Socket();
    process.nextTick(() =>
      socket.emit('error', Object.assign(new Error('connect ECONNREFUSED (simulated)'), { code: 'ECONNREFUSED' })),
    );
    return socket;
  }) as typeof net.createConnection);
}

describe('UnixSocketPubSub split-brain', () => {
  const pubsubs: UnixSocketPubSub[] = [];
  let tempDir: string | undefined;

  async function socketPath() {
    tempDir ??= await mkdtemp(join(tmpdir(), 'mastra-uds-split-'));
    return join(tempDir, 'events.sock');
  }

  function create(path: string, brokerPathCheckIntervalMs = 50) {
    const pubsub = new UnixSocketPubSub(path, { brokerPathCheckIntervalMs });
    pubsubs.push(pubsub);
    return pubsub;
  }

  /** Publishes from `publisher` until `subscriber` sees it, proving both reach the same broker. */
  async function expectConnected(publisher: UnixSocketPubSub, subscriber: UnixSocketPubSub, timeoutMs = 3000) {
    const topic = `probe-${globalThis.crypto.randomUUID()}`;
    const received = vi.fn();
    await subscriber.subscribe(topic, received);
    try {
      await waitFor(async () => {
        await publisher.publish(topic, makeEvent('probe'));
        await new Promise(resolve => setTimeout(resolve, 20));
        expect(received).toHaveBeenCalled();
      }, timeoutMs);
    } finally {
      await subscriber.unsubscribe(topic, received);
    }
  }

  afterEach(async () => {
    vi.restoreAllMocks();
    await Promise.allSettled(pubsubs.splice(0).map(pubsub => pubsub.close()));
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
      tempDir = undefined;
    }
  });

  it('does not replace a live broker when a newcomer is briefly refused', async () => {
    const path = await socketPath();
    const broker = create(path);
    const follower = create(path);
    await broker.subscribe('warmup', vi.fn());
    await follower.subscribe('warmup', vi.fn());
    expect(broker.isBroker).toBe(true);

    refuseNextConnects(2);
    const newcomer = create(path);
    await newcomer.subscribe('warmup', vi.fn());
    vi.restoreAllMocks();

    expect(newcomer.isBroker).toBe(false);
    await expectConnected(newcomer, follower);
  });

  it('rejoins one broker after an election wrongly replaces a live broker', async () => {
    const path = await socketPath();
    const broker = create(path);
    const follower = create(path);
    await broker.subscribe('warmup', vi.fn());
    await follower.subscribe('warmup', vi.fn());

    // Refuse long enough that the newcomer gives up on the live broker and elects itself.
    refuseNextConnects(50);
    const newcomer = create(path);
    await newcomer.subscribe('warmup', vi.fn());
    vi.restoreAllMocks();

    await expectConnected(newcomer, follower);
    await expectConnected(follower, newcomer);
    expect([broker.isBroker, follower.isBroker, newcomer.isBroker].filter(Boolean)).toHaveLength(1);
  });

  it('rejoins one broker after a live broker socket file is deleted', async () => {
    const path = await socketPath();
    const broker = create(path);
    const follower = create(path);
    await broker.subscribe('warmup', vi.fn());
    await follower.subscribe('warmup', vi.fn());

    // e.g. a cleanup script, or a departing process unlinking by name.
    await unlink(path);
    const newcomer = create(path);
    await newcomer.subscribe('warmup', vi.fn());

    await expectConnected(newcomer, follower);
    await expectConnected(follower, newcomer);
    expect([broker.isBroker, follower.isBroker, newcomer.isBroker].filter(Boolean)).toHaveLength(1);
  });

  it('does not delete the socket of the broker that replaced it when closing', async () => {
    const path = await socketPath();
    // No path checks here: the old broker must not notice it was replaced
    // and hand over before it closes.
    const noCheck = 60_000;
    const oldBroker = create(path, noCheck);
    await oldBroker.subscribe('warmup', vi.fn());

    await unlink(path);
    const newBroker = create(path, noCheck);
    await newBroker.subscribe('warmup', vi.fn());
    const newBrokerClient = create(path, noCheck);
    await newBrokerClient.subscribe('warmup', vi.fn());

    await oldBroker.close();

    const late = create(path, noCheck);
    await late.subscribe('warmup', vi.fn());
    await expectConnected(late, newBrokerClient);
    expect([newBroker.isBroker, newBrokerClient.isBroker, late.isBroker].filter(Boolean)).toHaveLength(1);
  });

  it('stays on one broker across repeated broker restarts while clients reconnect', async () => {
    const path = await socketPath();
    const stable = [create(path), create(path), create(path)];
    for (const pubsub of stable) await pubsub.subscribe('warmup', vi.fn());

    for (let round = 0; round < 5; round++) {
      const restarting = create(path);
      await restarting.subscribe('warmup', vi.fn());
      const broker = [...stable, restarting].find(pubsub => pubsub.isBroker);
      if (broker && broker !== restarting) {
        // Restart the current broker: close it, start a replacement immediately.
        await broker.close();
        stable.splice(stable.indexOf(broker), 1, create(path));
        await stable.at(-1)!.subscribe('warmup', vi.fn());
      }
      await restarting.close();
    }

    const late = create(path);
    await late.subscribe('warmup', vi.fn());
    for (const pubsub of stable) await expectConnected(late, pubsub);
  });
});
