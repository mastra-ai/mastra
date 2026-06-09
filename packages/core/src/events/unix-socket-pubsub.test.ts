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
});
