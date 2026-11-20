import type { RedisClusterType } from 'redis';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RedisStreamsPubSub } from './index';

const clients = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock('redis', () => ({ createClient: clients.create }));

// Default publishes (idle TTL on) run XADD + PEXPIRE in one MULTI.
function fakeMulti(onExec: () => void = () => {}) {
  return vi.fn(() => {
    const tx = {
      xAdd: () => tx,
      pExpire: () => tx,
      exec: vi.fn(async () => {
        onExec();
        return ['1-0', 1];
      }),
    };
    return tx;
  });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(res => {
    resolve = res;
  });
  return { promise, resolve };
}

describe('close() drains in-flight publishes', () => {
  afterEach(() => {
    clients.create.mockReset();
  });

  it('waits for a publish that is still connecting before quitting the writer', async () => {
    // A workflow's terminal event is frequently the last publish before
    // shutdown. Quitting the writer under it dropped the event and rejected
    // the publisher with a ClosingError (reported on mastra-ai/mastra#22863).
    const connect = deferred<void>();
    const order: string[] = [];
    const writer = {
      isOpen: false,
      on: vi.fn(),
      connect: vi.fn(async () => {
        await connect.promise;
        writer.isOpen = true;
      }),
      quit: vi.fn(async () => {
        order.push('quit');
      }),
      multi: fakeMulti(() => order.push('xAdd')),
    };
    clients.create.mockReturnValue(writer);
    const pubsub = new RedisStreamsPubSub();

    const publish = pubsub.publish('workflows', { type: 'workflow.end', data: {}, runId: 'run-1' });
    const close = pubsub.close();
    let closed = false;
    void close.then(() => {
      closed = true;
    });
    await Promise.resolve();
    expect(closed).toBe(false);

    connect.resolve();
    await expect(publish).resolves.toBeUndefined();
    await close;

    expect(order).toEqual(['xAdd', 'quit']);
  });

  it('rejects publishes issued after close()', async () => {
    const writer = { isOpen: false, on: vi.fn(), connect: vi.fn(), quit: vi.fn(), xAdd: vi.fn(), multi: fakeMulti() };
    clients.create.mockReturnValue(writer);
    const pubsub = new RedisStreamsPubSub();
    await pubsub.close();
    await expect(pubsub.publish('workflows', { type: 'x', data: {}, runId: 'r' })).rejects.toThrow(
      'cannot publish on closed client',
    );
    expect(writer.xAdd).not.toHaveBeenCalled();
    expect(writer.multi).not.toHaveBeenCalled();
  });

  it('destroys a cluster writer instead of quitting it while a node is reconnecting', async () => {
    // Cluster quit() quits every node client, and node-redis quit() on a node
    // in reconnect backoff never settles.
    const node = { client: { isOpen: true, isReady: true } };
    const cluster = {
      isOpen: false,
      masters: [node],
      replicas: [],
      on: vi.fn(),
      connect: vi.fn(async () => {
        cluster.isOpen = true;
      }),
      quit: vi.fn(() => new Promise<void>(() => {})),
      destroy: vi.fn(),
      multi: fakeMulti(),
    };
    const pubsub = new RedisStreamsPubSub({ client: cluster as unknown as RedisClusterType });
    await pubsub.publish('workflows', { type: 'x', data: {}, runId: 'r' });

    node.client.isReady = false;
    await pubsub.close();

    expect(cluster.destroy).toHaveBeenCalledTimes(1);
    expect(cluster.quit).not.toHaveBeenCalled();
  });
});
