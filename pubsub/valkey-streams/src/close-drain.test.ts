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
