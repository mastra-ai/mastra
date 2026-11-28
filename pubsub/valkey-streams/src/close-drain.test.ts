import { afterEach, describe, expect, it, vi } from 'vitest';
import { ValkeyStreamsPubSub } from './index';

const clients = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock('./client.js', () => ({ createClient: clients.create }));

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
      // Default publishes (idle TTL on) run XADD + PEXPIRE in one MULTI.
      multi: vi.fn(() => {
        const tx = {
          xAdd: () => tx,
          pExpire: () => tx,
          exec: vi.fn(async () => {
            order.push('xAdd');
            return ['1-0', 1];
          }),
        };
        return tx;
      }),
    };
    clients.create.mockReturnValue(writer);
    const pubsub = new ValkeyStreamsPubSub();

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

  it('releases a lease while close() flushes, and not once the writer has quit', async () => {
    // A step that fails during shutdown releases its lease and nacks. The nack
    // republishes through the writer that close() still holds open, so the release
    // must go through too or the redelivered step finds its lease held.
    const xAdd = deferred<void>();
    const order: string[] = [];
    const writer = {
      isOpen: true,
      on: vi.fn(),
      connect: vi.fn(),
      quit: vi.fn(async () => {
        order.push('quit');
        writer.isOpen = false;
      }),
      eval: vi.fn(async () => {
        order.push('release');
        return 1;
      }),
      multi: vi.fn(() => {
        const tx = {
          xAdd: () => tx,
          pExpire: () => tx,
          exec: vi.fn(async () => {
            await xAdd.promise;
            order.push('xAdd');
            return ['1-0', 1];
          }),
        };
        return tx;
      }),
    };
    clients.create.mockReturnValue(writer);
    const pubsub = new ValkeyStreamsPubSub();

    const publish = pubsub.publish('workflows', { type: 'workflow.step.end', data: {}, runId: 'run-1' });
    const close = pubsub.close();
    await pubsub.releaseLease('workflow-step-run:run-1:event-1', 'owner-1');
    xAdd.resolve();
    await publish;
    await close;
    await pubsub.releaseLease('workflow-step-run:run-1:event-1', 'owner-1');

    expect(order).toEqual(['release', 'xAdd', 'quit']);
    expect(writer.connect).not.toHaveBeenCalled();
  });

  it('rejects publishes issued after close()', async () => {
    const writer = { isOpen: false, on: vi.fn(), connect: vi.fn(), quit: vi.fn(), xAdd: vi.fn(), multi: vi.fn() };
    clients.create.mockReturnValue(writer);
    const pubsub = new ValkeyStreamsPubSub();
    await pubsub.close();
    await expect(pubsub.publish('workflows', { type: 'x', data: {}, runId: 'r' })).rejects.toThrow(
      'cannot publish on closed client',
    );
    expect(writer.xAdd).not.toHaveBeenCalled();
    expect(writer.multi).not.toHaveBeenCalled();
  });
});

describe('last fan-out member teardown ordering', () => {
  afterEach(() => {
    clients.create.mockReset();
  });

  // A reader parked in a blocking XREADGROUP until `release()` lets it return
  // (as CLIENT UNBLOCK or a real close would). `settled` fires only after the
  // loop's awaited read resolves, so the recorded order can prove the loop
  // settled before the reader was closed or the group dropped.
  function blockedRead(order: string[]) {
    const gate = deferred<void>();
    const started = deferred<void>();
    const read = async () => {
      started.resolve();
      await gate.promise;
      order.push('read-settled');
      return null;
    };
    return { read, started: started.promise, release: () => gate.resolve() };
  }

  function writerStub(order: string[], onUnblock: () => number) {
    const writer = {
      isOpen: true,
      on: vi.fn(),
      connect: vi.fn(),
      quit: vi.fn(async () => {
        writer.isOpen = false;
      }),
      command: vi.fn(async (args: string[]) => {
        if (args[0] === 'CLIENT' && args[1] === 'UNBLOCK') {
          order.push(`unblock:${args[2]}`);
          return onUnblock();
        }
        return 1;
      }),
      multi: vi.fn(() => {
        const tx = { xGroupCreate: () => tx, pExpire: () => tx, exec: vi.fn(async () => [1, 1]) };
        return tx;
      }),
      xGroupDestroy: vi.fn(async () => {
        order.push('destroy');
        return 1;
      }),
      del: vi.fn(async () => {
        order.push('del');
        return 1;
      }),
      xRange: vi.fn(async () => []),
      xRevRange: vi.fn(async () => []),
      xInfoGroups: vi.fn(async () => []),
      xAck: vi.fn(async () => 1),
    };
    return writer;
  }

  function readerStub(
    order: string[],
    read: () => Promise<null>,
    options: { clientId?: number; onId?: () => number; onQuit?: () => void } = {},
  ) {
    const reader = {
      isOpen: true,
      on: vi.fn(),
      connect: vi.fn(async () => {
        reader.isOpen = true;
      }),
      quit: vi.fn(async () => {
        order.push('quit');
        reader.isOpen = false;
        options.onQuit?.();
      }),
      command: vi.fn(async (args: string[]) => {
        if (args[0] === 'CLIENT' && args[1] === 'ID') {
          if (options.clientId === undefined) throw new Error('unknown subcommand CLIENT ID');
          return String(options.clientId);
        }
        return 1;
      }),
      xReadGroup: vi.fn(read),
      xAck: vi.fn(async () => 1),
    };
    return reader;
  }

  // First createClient() call is the shared writer; later calls are readers.
  function useClients(writer: unknown, reader: unknown) {
    let created = 0;
    clients.create.mockImplementation(() => (created++ === 0 ? writer : reader));
  }

  it('unblocks, drains and then drops the group for the last fan-out member', async () => {
    // The previous order closed the reader first: quit() returns before the
    // server releases the blocked XREADGROUP, which then logs NOGROUP once the
    // group is destroyed (mastra-ai/mastra#31465). The read must settle before
    // the reader closes and before XGROUP DESTROY.
    const order: string[] = [];
    const block = blockedRead(order);
    const writer = writerStub(order, () => {
      block.release();
      return 1;
    });
    const reader = readerStub(order, block.read, { clientId: 4242, onQuit: block.release });
    useClients(writer, reader);
    const pubsub = new ValkeyStreamsPubSub();

    const cb = async () => {};
    await pubsub.subscribe('topic-a', cb);
    await block.started;
    await pubsub.unsubscribe('topic-a', cb);

    expect(order).toEqual(['unblock:4242', 'read-settled', 'quit', 'destroy']);
    expect(writer.command).toHaveBeenCalledWith(['CLIENT', 'UNBLOCK', '4242']);
    expect(reader.quit).toHaveBeenCalledTimes(1);
    expect(writer.xGroupDestroy).toHaveBeenCalledTimes(1);
  });

  it('waits for the pending finite read when no client id is available', async () => {
    // CLIENT ID can be denied (ACL) or unsupported (older server). Subscribing
    // must still succeed and teardown must not hang: with a finite blockMs the
    // read returns on its own, so it is awaited rather than force-closed.
    const order: string[] = [];
    const block = blockedRead(order);
    const writer = writerStub(order, () => 0);
    const reader = readerStub(order, block.read, { onQuit: block.release });
    useClients(writer, reader);
    const pubsub = new ValkeyStreamsPubSub();

    const cb = async () => {};
    await pubsub.subscribe('topic-b', cb);
    await block.started;
    const teardown = pubsub.unsubscribe('topic-b', cb);
    block.release();
    await teardown;

    expect(order).toEqual(['read-settled', 'quit', 'destroy']);
    expect(writer.command).not.toHaveBeenCalled();
    expect(reader.quit).toHaveBeenCalledTimes(1);
  });

  it('closes the reader before draining when an unbounded read cannot be unblocked', async () => {
    // blockMs: 0 permits a read that never returns. If UNBLOCK reports "not
    // blocked" (0) there is nothing to interrupt it, so the reader is closed to
    // break the block — but the loop must still settle, and only then is the
    // group dropped.
    const order: string[] = [];
    const block = blockedRead(order);
    const writer = writerStub(order, () => 0);
    const reader = readerStub(order, block.read, { clientId: 7, onQuit: block.release });
    useClients(writer, reader);
    const pubsub = new ValkeyStreamsPubSub({ blockMs: 0 });

    const cb = async () => {};
    await pubsub.subscribe('topic-c', cb);
    await block.started;
    await pubsub.unsubscribe('topic-c', cb);

    expect(order).toEqual(['unblock:7', 'quit', 'read-settled', 'destroy']);
    expect(writer.command).toHaveBeenCalledWith(['CLIENT', 'UNBLOCK', '7']);
    expect(reader.quit).toHaveBeenCalledTimes(1);
  });

  it('clearTopic waits for the topic teardown before deleting, not other topics', async () => {
    // A concurrent clearTopic(topic) must let the reader finish draining before
    // DEL removes the stream, or the drain observes NOGROUP and its own XGROUP
    // DESTROY races the DEL (mastra-ai/mastra#31465). It must not wait on an
    // unrelated topic's teardown.
    const order: string[] = [];
    const blockD = blockedRead(order);
    const blockE = blockedRead(order);
    const writer = writerStub(order, () => 0);
    const readers = [
      readerStub(order, blockD.read, { onQuit: blockD.release }),
      readerStub(order, blockE.read, { onQuit: blockE.release }),
    ];
    let created = 0;
    clients.create.mockImplementation(() => {
      const index = created++;
      return index === 0 ? writer : readers[index - 1];
    });
    const pubsub = new ValkeyStreamsPubSub();

    const cbD = async () => {};
    const cbE = async () => {};
    await pubsub.subscribe('topic-d', cbD);
    await pubsub.subscribe('topic-e', cbE);
    await Promise.all([blockD.started, blockE.started]);

    const teardownD = pubsub.unsubscribe('topic-d', cbD);
    const teardownE = pubsub.unsubscribe('topic-e', cbE);
    const clear = pubsub.clearTopic('topic-d');

    // topic-d's teardown is still draining, so DEL must not have run yet.
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(writer.del).not.toHaveBeenCalled();

    blockD.release();
    await clear;
    expect(writer.del).toHaveBeenCalledTimes(1);
    // The drain (and its XGROUP DESTROY) settled before the DEL.
    expect(order).toEqual(['read-settled', 'quit', 'destroy', 'del']);

    blockE.release();
    await Promise.all([teardownD, teardownE]);
  });

  it('destroys the group once when unsubscribe runs again', async () => {
    const order: string[] = [];
    const block = blockedRead(order);
    const writer = writerStub(order, () => {
      block.release();
      return 1;
    });
    const reader = readerStub(order, block.read, { clientId: 11, onQuit: block.release });
    useClients(writer, reader);
    const pubsub = new ValkeyStreamsPubSub();

    const cb = async () => {};
    await pubsub.subscribe('topic-f', cb);
    await block.started;
    const first = pubsub.unsubscribe('topic-f', cb);
    const second = pubsub.unsubscribe('topic-f', cb);
    await Promise.all([first, second]);

    expect(writer.xGroupDestroy).toHaveBeenCalledTimes(1);
    expect(reader.quit).toHaveBeenCalledTimes(1);
  });

  it('unblocks and drains but keeps the group for a grouped subscription', async () => {
    // Grouped subscriptions share a group with other consumers, so teardown must
    // interrupt and drain (same NOGROUP avoidance) but never destroy the group.
    const order: string[] = [];
    const block = blockedRead(order);
    const writer = writerStub(order, () => {
      block.release();
      return 1;
    });
    const reader = readerStub(order, block.read, { clientId: 55, onQuit: block.release });
    useClients(writer, reader);
    const pubsub = new ValkeyStreamsPubSub();

    const cb = async () => {};
    await pubsub.subscribe('topic-g', cb, { group: 'workers' });
    await block.started;
    await pubsub.unsubscribe('topic-g', cb);

    expect(order).toEqual(['unblock:55', 'read-settled', 'quit']);
    expect(writer.xGroupDestroy).not.toHaveBeenCalled();
    expect(reader.quit).toHaveBeenCalledTimes(1);
  });
});
