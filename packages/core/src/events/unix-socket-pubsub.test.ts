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

  it('rejects subscribe when the broker disconnects before acknowledging', async () => {
    const path = await socketPath();
    const server = net.createServer(socket => {
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
