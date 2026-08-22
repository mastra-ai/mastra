import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import net from 'node:net';
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

async function waitFor(assertion: () => void, timeoutMs = 1000): Promise<void> {
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

describe('UnixSocketPubSub', () => {
  const pubsubs: UnixSocketPubSub[] = [];
  let tempDir: string | undefined;

  async function socketPath(name = 'events.sock') {
    tempDir ??= await mkdtemp(join(tmpdir(), 'mastra-uds-pubsub-'));
    return join(tempDir, name);
  }

  afterEach(async () => {
    await Promise.allSettled(pubsubs.splice(0).map(pubsub => pubsub.close()));
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
      tempDir = undefined;
    }
  });

  it('fans out events between instances using the same socket path', async () => {
    const path = await socketPath();
    const first = new UnixSocketPubSub(path);
    const second = new UnixSocketPubSub(path);
    pubsubs.push(first, second);

    const firstCb = vi.fn();
    const secondCb = vi.fn();
    await first.subscribe('topic-a', firstCb);
    await second.subscribe('topic-a', secondCb);

    await first.publish('topic-a', makeEvent({ type: 'hello' }));

    await waitFor(() => {
      expect(firstCb).toHaveBeenCalledTimes(1);
      expect(secondCb).toHaveBeenCalledTimes(1);
    });
    expect(secondCb.mock.calls[0]![0].type).toBe('hello');
  });

  it('round-robins local subscribers in the same group', async () => {
    const path = await socketPath();
    const pubsub = new UnixSocketPubSub(path);
    pubsubs.push(pubsub);

    const firstCb = vi.fn();
    const secondCb = vi.fn();
    await pubsub.subscribe('topic-a', firstCb, { group: 'workers' });
    await pubsub.subscribe('topic-a', secondCb, { group: 'workers' });

    await pubsub.publish('topic-a', makeEvent({ type: 'first' }));
    await pubsub.publish('topic-a', makeEvent({ type: 'second' }));

    expect(firstCb).toHaveBeenCalledTimes(1);
    expect(secondCb).toHaveBeenCalledTimes(1);
  });

  it('fans out to ungrouped subscribers and selects one process per group', async () => {
    const path = await socketPath();
    const broker = new UnixSocketPubSub(path);
    const clientA = new UnixSocketPubSub(path);
    const clientB = new UnixSocketPubSub(path);
    pubsubs.push(broker, clientA, clientB);

    const brokerFanout = vi.fn();
    const clientFanout = vi.fn();
    const brokerWorker = vi.fn();
    const clientAWorker = vi.fn();
    const clientBWorker = vi.fn();
    await broker.subscribe('topic-a', brokerFanout);
    await clientA.subscribe('topic-a', clientFanout);
    await broker.subscribe('topic-a', brokerWorker, { group: 'workers' });
    await clientA.subscribe('topic-a', clientAWorker, { group: 'workers' });
    await clientB.subscribe('topic-a', clientBWorker, { group: 'workers' });

    for (let index = 0; index < 6; index++) {
      await broker.publish('topic-a', makeEvent({ type: `event-${index}` }));
    }

    await waitFor(() => {
      expect(brokerFanout).toHaveBeenCalledTimes(6);
      expect(clientFanout).toHaveBeenCalledTimes(6);
      expect(brokerWorker).toHaveBeenCalledTimes(2);
      expect(clientAWorker).toHaveBeenCalledTimes(2);
      expect(clientBWorker).toHaveBeenCalledTimes(2);
    });
  });

  it('delivers once to each independent group on a topic', async () => {
    const path = await socketPath();
    const broker = new UnixSocketPubSub(path);
    const client = new UnixSocketPubSub(path);
    pubsubs.push(broker, client);

    const workers = vi.fn();
    const auditors = vi.fn();
    await broker.subscribe('topic-a', workers, { group: 'workers' });
    await client.subscribe('topic-a', auditors, { group: 'auditors' });

    await broker.publish('topic-a', makeEvent({ type: 'grouped' }));

    await waitFor(() => {
      expect(workers).toHaveBeenCalledTimes(1);
      expect(auditors).toHaveBeenCalledTimes(1);
    });
  });

  it('removes a remote group membership only after its last local subscriber unsubscribes', async () => {
    const path = await socketPath();
    const broker = new UnixSocketPubSub(path);
    const client = new UnixSocketPubSub(path);
    pubsubs.push(broker, client);

    const first = vi.fn();
    const second = vi.fn();
    await client.subscribe('topic-a', first, { group: 'workers' });
    await client.subscribe('topic-a', second, { group: 'workers' });
    await client.unsubscribe('topic-a', first);

    await broker.publish('topic-a', makeEvent({ type: 'still-subscribed' }));
    await waitFor(() => expect(second).toHaveBeenCalledTimes(1));

    await client.unsubscribe('topic-a', second);
    await broker.publish('topic-a', makeEvent({ type: 'unsubscribed' }));
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('keeps localOnly grouped delivery within the publishing instance', async () => {
    const path = await socketPath();
    const broker = new UnixSocketPubSub(path);
    const client = new UnixSocketPubSub(path);
    pubsubs.push(broker, client);

    const brokerWorker = vi.fn();
    const clientWorker = vi.fn();
    await broker.subscribe('topic-a', brokerWorker, { group: 'workers' });
    await client.subscribe('topic-a', clientWorker, { group: 'workers' });

    await client.publish('topic-a', makeEvent({ type: 'local-grouped' }), { localOnly: true });

    expect(clientWorker).toHaveBeenCalledTimes(1);
    expect(brokerWorker).not.toHaveBeenCalled();
  });

  it('relays client-published events back to the publishing client', async () => {
    const path = await socketPath();
    const broker = new UnixSocketPubSub(path);
    const client = new UnixSocketPubSub(path);
    pubsubs.push(broker, client);

    const brokerCb = vi.fn();
    const clientCb = vi.fn();
    await broker.subscribe('topic-a', brokerCb);
    await client.subscribe('topic-a', clientCb);

    expect(broker.isBroker).toBe(true);
    expect(client.isBroker).toBe(false);

    // Client publishes — broker should relay back to the client
    await client.publish('topic-a', makeEvent({ type: 'from-client' }));

    await waitFor(() => {
      expect(brokerCb).toHaveBeenCalledTimes(1);
      expect(clientCb).toHaveBeenCalledTimes(1);
    });
    expect(brokerCb.mock.calls[0]![0].type).toBe('from-client');
    expect(clientCb.mock.calls[0]![0].type).toBe('from-client');
  });

  it('_localOnly events stay entirely within the publishing instance', async () => {
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

    // ClientA publishes a localOnly event — only clientA's own subscribers
    // see it. The broker and clientB are different PubSub instances (even when
    // they share an OS process in this test) and must not receive the event,
    // because crossing the broker would JSON-serialize the payload and strip
    // any live methods (e.g. MastraModelOutput.getFullOutput).
    await clientA.publish('topic-a', makeEvent({ type: 'internal' }), { localOnly: true });

    await waitFor(() => {
      expect(clientACb).toHaveBeenCalledTimes(1);
    });
    // Allow extra time for any unintended relay to broker or clientB
    await new Promise(r => setTimeout(r, 100));
    expect(brokerCb).not.toHaveBeenCalled();
    expect(clientBCb).not.toHaveBeenCalled();
  });

  it('_localOnly events published by the broker only fire the broker subscribers', async () => {
    const path = await socketPath();
    const broker = new UnixSocketPubSub(path);
    const client = new UnixSocketPubSub(path);
    pubsubs.push(broker, client);

    const brokerCb = vi.fn();
    const clientCb = vi.fn();
    await broker.subscribe('topic-a', brokerCb);
    await client.subscribe('topic-a', clientCb);

    // Broker publishes localOnly — only broker's own subscribers fire.
    await broker.publish('topic-a', makeEvent({ type: 'internal' }), { localOnly: true });

    await waitFor(() => {
      expect(brokerCb).toHaveBeenCalledTimes(1);
    });
    await new Promise(r => setTimeout(r, 100));
    expect(clientCb).not.toHaveBeenCalled();
  });

  it('localOnly prevents large payloads from crossing the wire to any other instance', async () => {
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

    // Simulate the real problem: a 2 MB cumulative stepResults payload
    const largePayload = 'x'.repeat(2 * 1024 * 1024);

    // With localOnly: only clientA (the publisher) sees it.
    await clientA.publish('topic-a', makeEvent({ type: 'step.end', data: { stepResults: largePayload } }), {
      localOnly: true,
    });

    await waitFor(() => {
      expect(clientACb).toHaveBeenCalledTimes(1);
    });
    await new Promise(r => setTimeout(r, 200));
    expect(brokerCb).not.toHaveBeenCalled();
    expect(clientBCb).not.toHaveBeenCalled();

    // Without localOnly: same large event fans out to broker + both clients
    await clientA.publish('topic-a', makeEvent({ type: 'step.end', data: { stepResults: largePayload } }));

    await waitFor(() => {
      expect(clientBCb).toHaveBeenCalledTimes(1);
    });
    expect(brokerCb).toHaveBeenCalledTimes(1);
    expect(clientACb).toHaveBeenCalledTimes(2);
  });

  it('localOnly preserves non-serializable payload values (live class instances)', async () => {
    const path = await socketPath();
    const broker = new UnixSocketPubSub(path);
    const clientA = new UnixSocketPubSub(path);
    pubsubs.push(broker, clientA);

    const clientACb = vi.fn();
    await clientA.subscribe('topic-a', clientACb);

    // Payload with a live method that JSON.stringify would drop. This is the
    // exact shape `processWorkflowEnd` publishes on `workflows-finish` for the
    // execution-workflow: the run result is a MastraModelOutput instance whose
    // getFullOutput() method must survive delivery.
    class LiveResult {
      getValue() {
        return 'still alive';
      }
    }
    const liveResult = new LiveResult();

    await clientA.publish('topic-a', makeEvent({ type: 'workflow.end', data: { result: liveResult } as any }), {
      localOnly: true,
    });

    await waitFor(() => {
      expect(clientACb).toHaveBeenCalledTimes(1);
    });
    const delivered = clientACb.mock.calls[0]![0] as Event;
    const deliveredResult = (delivered.data as { result: LiveResult }).result;
    // Must be the same instance with the method intact
    expect(deliveredResult).toBe(liveResult);
    expect(typeof deliveredResult.getValue).toBe('function');
    expect(deliveredResult.getValue()).toBe('still alive');
  });

  it('allows a temporarily backpressured remote client to catch up below the queue cap', async () => {
    const path = await socketPath();
    const broker = new UnixSocketPubSub(path, { maxRemoteClientQueuedBytes: 1024 * 1024 });
    pubsubs.push(broker);

    const brokerCb = vi.fn();
    await broker.subscribe('topic-a', brokerCb);

    const frames: any[] = [];
    const rawClient = net.createConnection(path);
    rawClient.setEncoding('utf8');
    let buffer = '';
    rawClient.on('data', (chunk: string) => {
      buffer += chunk;
      while (true) {
        const newlineIndex = buffer.indexOf('\n');
        if (newlineIndex === -1) break;
        const line = buffer.slice(0, newlineIndex);
        buffer = buffer.slice(newlineIndex + 1);
        if (line.trim()) frames.push(JSON.parse(line));
      }
    });

    const waitForRawFrame = async (predicate: (frame: any) => boolean) => {
      await waitFor(() => {
        expect(frames.some(predicate)).toBe(true);
      });
    };

    try {
      await new Promise<void>((resolve, reject) => {
        rawClient.once('connect', resolve);
        rawClient.once('error', reject);
      });
      await new Promise<void>((resolve, reject) => {
        rawClient.write(`${JSON.stringify({ type: 'subscribe', topic: 'topic-a' })}\n`, (error?: Error | null) => {
          if (error) reject(error);
          else resolve();
        });
      });
      await waitForRawFrame(frame => frame.type === 'subscribed' && frame.topic === 'topic-a');
      rawClient.pause();

      const payload = 'x'.repeat(16 * 1024);
      for (let i = 0; i < 4; i++) {
        await broker.publish('topic-a', makeEvent({ type: `recover-${i}`, data: { payload } }));
      }

      expect(broker.remoteClientCount).toBe(1);
      expect(brokerCb).toHaveBeenCalledTimes(4);
      rawClient.resume();

      await waitForRawFrame(frame => frame.type === 'event' && frame.event?.type === 'recover-3');
      expect(broker.remoteClientCount).toBe(1);
    } finally {
      rawClient.destroy();
    }
  });

  it('does not let a backpressured remote client block local or healthy subscribers', async () => {
    const path = await socketPath();
    const broker = new UnixSocketPubSub(path, { maxRemoteClientQueuedBytes: 256 * 1024 });
    const healthy = new UnixSocketPubSub(path, { maxRemoteClientQueuedBytes: 256 * 1024 });
    pubsubs.push(broker, healthy);

    const brokerCb = vi.fn();
    const healthyCb = vi.fn();
    await broker.subscribe('topic-a', brokerCb);
    await healthy.subscribe('topic-a', healthyCb);

    const stuck = net.createConnection(path);
    try {
      await new Promise<void>((resolve, reject) => {
        stuck.once('connect', resolve);
        stuck.once('error', reject);
      });
      await new Promise<void>((resolve, reject) => {
        stuck.write(`${JSON.stringify({ type: 'subscribe', topic: 'topic-a' })}\n`, (error?: Error | null) => {
          if (error) reject(error);
          else resolve();
        });
      });
      stuck.pause();

      await waitFor(() => {
        expect(broker.remoteClientCount).toBe(2);
      });
      await new Promise(resolve => setTimeout(resolve, 0));

      const payload = 'x'.repeat(32 * 1024);
      for (let i = 0; i < 20; i++) {
        const result = await Promise.race([
          broker.publish('topic-a', makeEvent({ type: `large-${i}`, data: { payload } })).then(() => 'published'),
          new Promise(resolve => setTimeout(() => resolve('timeout'), 500)),
        ]);
        expect(result).toBe('published');
        await new Promise(resolve => setTimeout(resolve, 0));
      }

      expect(brokerCb).toHaveBeenCalledTimes(20);
      await waitFor(() => {
        expect(healthyCb.mock.calls.some(call => call[0].type === 'large-19')).toBe(true);
      });
      await waitFor(() => {
        expect(broker.remoteClientCount).toBe(1);
      });
    } finally {
      stuck.destroy();
    }
  });

  it('isolates local subscriber failures from other subscribers', async () => {
    const path = await socketPath();
    const pubsub = new UnixSocketPubSub(path);
    pubsubs.push(pubsub);

    const goodCb = vi.fn();
    await pubsub.subscribe('topic-a', () => {
      throw new Error('subscriber failed');
    });
    await pubsub.subscribe('topic-a', async () => {
      throw new Error('async subscriber failed');
    });
    await pubsub.subscribe('topic-a', goodCb);

    await pubsub.publish('topic-a', makeEvent({ type: 'isolated' }));

    expect(goodCb).toHaveBeenCalledTimes(1);
  });

  it('rejects subscribe when the broker disconnects before acknowledging', async () => {
    const path = await socketPath();
    const server = net.createServer((socket: net.Socket) => {
      socket.once('data', () => socket.destroy());
    });
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(path, () => resolve());
    });
    const pubsub = new UnixSocketPubSub(path);
    pubsubs.push(pubsub);
    const cb = vi.fn();

    try {
      await expect(pubsub.subscribe('topic-a', cb)).rejects.toThrow('broker connection closed');
    } finally {
      await new Promise<void>(resolve => server.close(() => resolve()));
    }

    await pubsub.publish('topic-a', makeEvent({ type: 'after-failed-subscribe' }));
    expect(cb).not.toHaveBeenCalled();
  });

  it('does not re-send duplicate callback subscriptions to the broker', async () => {
    const path = await socketPath();
    let subscribeCount = 0;
    const sockets = new Set<net.Socket>();
    const server = net.createServer((socket: net.Socket) => {
      sockets.add(socket);
      socket.on('close', () => sockets.delete(socket));
      socket.setEncoding('utf8');
      socket.on('data', (chunk: string) => {
        for (const line of chunk.split('\n')) {
          if (!line.trim()) continue;
          const frame = JSON.parse(line);
          if (frame.type !== 'subscribe') continue;
          subscribeCount += 1;
          socket.write(`${JSON.stringify({ type: 'subscribed', topic: frame.topic })}\n`);
        }
      });
    });
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(path, () => resolve());
    });
    const pubsub = new UnixSocketPubSub(path);
    pubsubs.push(pubsub);
    const cb = vi.fn();

    try {
      await pubsub.subscribe('topic-a', cb);
      await pubsub.subscribe('topic-a', cb);
    } finally {
      for (const socket of sockets) {
        socket.destroy();
      }
      await new Promise<void>(resolve => server.close(() => resolve()));
      await new Promise(resolve => setTimeout(resolve, 0));
    }

    expect(subscribeCount).toBe(1);
    await waitFor(() => {
      expect(pubsub.isBroker).toBe(true);
    });
    await pubsub.publish('topic-a', makeEvent({ type: 'after-duplicate-subscribe' }));
    await waitFor(() => {
      expect(cb).toHaveBeenCalledTimes(1);
    });
  });

  it('promotes another instance after the broker closes', async () => {
    const path = await socketPath();
    const broker = new UnixSocketPubSub(path);
    const follower = new UnixSocketPubSub(path);
    pubsubs.push(broker, follower);

    const cb = vi.fn();
    await broker.subscribe('topic-a', vi.fn());
    await follower.subscribe('topic-a', cb);
    expect(broker.isBroker).toBe(true);

    await broker.close();
    pubsubs.splice(pubsubs.indexOf(broker), 1);

    await follower.publish('topic-a', makeEvent({ type: 'after-close' }));

    await waitFor(() => {
      expect(follower.isBroker).toBe(true);
      expect(cb).toHaveBeenCalledTimes(1);
    });
  });

  it('preserves grouped subscriptions when a follower becomes the broker', async () => {
    const path = await socketPath();
    const broker = new UnixSocketPubSub(path);
    const follower = new UnixSocketPubSub(path);
    pubsubs.push(broker, follower);

    const worker = vi.fn();
    await broker.subscribe('topic-a', vi.fn(), { group: 'workers' });
    await follower.subscribe('topic-a', worker, { group: 'workers' });

    await broker.close();
    pubsubs.splice(pubsubs.indexOf(broker), 1);
    await follower.publish('topic-a', makeEvent({ type: 'after-grouped-close' }));

    await waitFor(() => {
      expect(follower.isBroker).toBe(true);
      expect(worker).toHaveBeenCalledTimes(1);
    });
  });

  it('reclaims a stale socket file', async () => {
    const path = await socketPath();
    await writeFile(path, 'stale');
    const pubsub = new UnixSocketPubSub(path);
    pubsubs.push(pubsub);

    const cb = vi.fn();
    await pubsub.subscribe('topic-a', cb);
    await pubsub.publish('topic-a', makeEvent({ type: 'reclaimed' }));

    expect(pubsub.isBroker).toBe(true);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  describe('local nack redelivery', () => {
    it('redelivers nacked events to the same subscriber with bumped deliveryAttempt', async () => {
      const path = await socketPath();
      const pubsub = new UnixSocketPubSub(path);
      pubsubs.push(pubsub);

      const attempts: number[] = [];
      let nacksRemaining = 2;
      await pubsub.subscribe('topic-a', async (event, _ack, nack) => {
        attempts.push(event.deliveryAttempt ?? 1);
        if (nacksRemaining > 0) {
          nacksRemaining--;
          await nack?.();
        }
      });

      await pubsub.publish('topic-a', makeEvent({ type: 'redelivered' }));

      await waitFor(() => {
        expect(attempts.length).toBe(3);
      });
      // Contract from Event type: deliveryAttempt starts at 1 and increments
      // on each redelivery so consumers can see how many times they've seen
      // the same logical event.
      expect(attempts).toEqual([1, 2, 3]);
    });

    it('caps local redeliveries so a permanently-nacking subscriber does not loop forever', async () => {
      const path = await socketPath();
      const pubsub = new UnixSocketPubSub(path);
      pubsubs.push(pubsub);

      let deliveries = 0;
      await pubsub.subscribe('topic-a', async (_event, _ack, nack) => {
        deliveries++;
        await nack?.();
      });

      await pubsub.publish('topic-a', makeEvent({ type: 'poison' }));

      // The redelivery schedule is bounded: with the current internal
      // constants the entire chain finishes in well under 3s. We don't
      // pin to a specific count because that's an internal tuning knob,
      // but we do prove the cap holds:
      //   1. wait past any plausible redelivery window,
      //   2. sample the count,
      //   3. wait again,
      //   4. assert the count did not move.
      // This catches the "retries are unbounded" regression that a single
      // short timeout would silently let through.
      await new Promise(resolve => setTimeout(resolve, 3000));
      const settled = deliveries;
      await new Promise(resolve => setTimeout(resolve, 1000));

      expect(deliveries).toBe(settled);
      // Sanity: there was at least one nack-driven redelivery, and the
      // total is small (current cap is 1 initial + 6 redeliveries = 7;
      // leave headroom so light tuning doesn't break the test).
      expect(deliveries).toBeGreaterThanOrEqual(2);
      expect(deliveries).toBeLessThanOrEqual(10);
    }, 10_000);

    it('does not redeliver after the subscription is removed', async () => {
      const path = await socketPath();
      const pubsub = new UnixSocketPubSub(path);
      pubsubs.push(pubsub);

      let deliveries = 0;
      const cb = async (_event: Event, _ack?: () => Promise<void>, nack?: () => Promise<void>): Promise<void> => {
        deliveries++;
        await nack?.();
        await pubsub.unsubscribe('topic-a', cb);
      };
      await pubsub.subscribe('topic-a', cb);

      await pubsub.publish('topic-a', makeEvent({ type: 'unsubscribed' }));

      await new Promise(resolve => setTimeout(resolve, 500));
      expect(deliveries).toBe(1);
    });
  });
});
