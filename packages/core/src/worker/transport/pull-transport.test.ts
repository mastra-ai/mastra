import { describe, expect, it, vi } from 'vitest';
import { EventEmitterPubSub } from '../../events/event-emitter';
import type { Event } from '../../events/types';
import { PullTransport } from './pull-transport';

function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>(r => {
    resolve = r;
  });
  return { promise, resolve };
}

const event: Event = { type: 'workflow.start', runId: 'run-1', data: {} } as Event;

describe('PullTransport.stop()', () => {
  it('waits for in-flight route() calls before flushing', async () => {
    const pubsub = new EventEmitterPubSub();
    const flush = vi.spyOn(pubsub, 'flush');
    const routing = deferred();
    const routed = deferred();
    const transport = new PullTransport({ pubsub, group: 'test' });

    await transport.start({
      route: async () => {
        routed.resolve();
        await routing.promise;
      },
    });
    await pubsub.publish('workflows', event);
    await routed.promise;

    let stopped = false;
    const stop = transport.stop().then(() => {
      stopped = true;
    });
    await new Promise(r => setTimeout(r, 20));
    expect(stopped).toBe(false);
    expect(flush).not.toHaveBeenCalled();

    routing.resolve();
    await stop;
    expect(flush).toHaveBeenCalledOnce();
  });

  it('gives up after drainTimeout when route() never settles', async () => {
    const pubsub = new EventEmitterPubSub();
    const flush = vi.spyOn(pubsub, 'flush');
    const routed = deferred();
    const transport = new PullTransport({ pubsub, group: 'test', drainTimeout: 50 });

    await transport.start({
      route: () => {
        routed.resolve();
        return new Promise(() => {});
      },
    });
    await pubsub.publish('workflows', event);
    await routed.promise;

    const startedAt = Date.now();
    await transport.stop();
    expect(Date.now() - startedAt).toBeLessThan(1_000);
    expect(flush).toHaveBeenCalledOnce();
  });
});
