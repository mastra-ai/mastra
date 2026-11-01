/**
 * Regression coverage for #29085: `startWorkers()` racing the lazy
 * `__ensureExecutionWorkersStarted()` (fired by background-task dispatch,
 * evented-workflow restart, durable agents) must not start the orchestration
 * worker — or the push-mode workflow subscription — twice. A duplicate
 * subscription makes every workflow event run twice on transports that fan
 * events out to every local subscriber.
 */
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';

import { EventEmitterPubSub } from '../events/event-emitter';
import type { PubSubDeliveryMode } from '../events/pubsub';
import type { EventCallback, SubscribeOptions } from '../events/types';
import { MockStore } from '../storage/mock';
import { createStep, createWorkflow } from '../workflows/evented';
import { Mastra } from '.';

/** Resolves subscribe() a tick late, like a networked broker, and records live workflow subscriptions. */
class DelayedSubscribePubSub extends EventEmitterPubSub {
  readonly live: string[] = [];
  readonly #keys = new Map<EventCallback, string>();

  constructor(private readonly modes: ReadonlyArray<PubSubDeliveryMode> = ['pull', 'push']) {
    super();
  }

  override get supportedModes(): ReadonlyArray<PubSubDeliveryMode> {
    return this.modes;
  }

  override async subscribe(topic: string, cb: EventCallback, options?: SubscribeOptions): Promise<void> {
    if (topic === 'workflows') {
      const key = `${topic}:${options?.group ?? 'fanout'}`;
      this.live.push(key);
      this.#keys.set(cb, key);
    }
    await new Promise(resolve => setTimeout(resolve, 1));
    return super.subscribe(topic, cb, options);
  }

  override async unsubscribe(topic: string, cb: EventCallback): Promise<void> {
    const key = this.#keys.get(cb);
    if (key) {
      this.live.splice(this.live.indexOf(key), 1);
      this.#keys.delete(cb);
    }
    return super.unsubscribe(topic, cb);
  }
}

function makeCountingWorkflow(execute: () => Promise<{ n: number }>) {
  const wf = createWorkflow({
    id: 'counting-workflow',
    inputSchema: z.object({}),
    outputSchema: z.object({ n: z.number() }),
  });
  wf.then(
    createStep({
      id: 'count',
      inputSchema: z.object({}),
      outputSchema: z.object({ n: z.number() }),
      execute,
    }) as any,
  ).commit();
  return wf;
}

describe('startWorkers() racing the lazy execution-worker start (#29085)', () => {
  it('starts the orchestration worker once', async () => {
    const pubsub = new DelayedSubscribePubSub();
    const mastra = new Mastra({ logger: false, storage: new MockStore(), pubsub });

    await Promise.all([mastra.startWorkers(), mastra.__ensureExecutionWorkersStarted()]);

    expect(pubsub.live.filter(key => key.startsWith('workflows:'))).toEqual(['workflows:mastra-orchestration']);

    await mastra.stopWorkers();
    expect(pubsub.live).toEqual([]);
  });

  it('starts the orchestration worker once when the lazy start runs first', async () => {
    const pubsub = new DelayedSubscribePubSub();
    const mastra = new Mastra({ logger: false, storage: new MockStore(), pubsub });

    await Promise.all([mastra.__ensureExecutionWorkersStarted(), mastra.startWorkers()]);

    expect(pubsub.live).toEqual(['workflows:mastra-orchestration']);

    await mastra.stopWorkers();
    expect(pubsub.live).toEqual([]);
  });

  it('wires the push-mode workflow subscription once and runs each step once', async () => {
    const pubsub = new DelayedSubscribePubSub(['push']);
    const execute = vi.fn(async () => ({ n: 1 }));
    const mastra = new Mastra({
      logger: false,
      storage: new MockStore(),
      pubsub,
      workflows: { countingWorkflow: makeCountingWorkflow(execute) as any },
    });

    await Promise.all([mastra.startWorkers(), mastra.__ensureExecutionWorkersStarted()]);
    expect(pubsub.live).toEqual(['workflows:fanout']);

    const run = await mastra.getWorkflow('countingWorkflow').createRun();
    const result = await run.start({ inputData: {} });

    expect(result.status).toBe('success');
    expect(execute).toHaveBeenCalledTimes(1);

    await mastra.stopWorkers();
    expect(pubsub.live).toEqual([]);
  });
});
