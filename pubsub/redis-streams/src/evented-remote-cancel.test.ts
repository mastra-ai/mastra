import { randomUUID } from 'node:crypto';
import { Mastra } from '@mastra/core/mastra';
import { InMemoryStore } from '@mastra/core/storage';
import { createStep, createWorkflow } from '@mastra/core/workflows/evented';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { RedisStreamsPubSub } from './index';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6381';
const WORKFLOW_ID = 'redis-remote-cancel';
const RUNS = 4;

type Label = 'owner' | 'other';

/**
 * Cancelling an evented run must settle the owner's `run.start()` as `canceled` and abort the
 * running step, with each replica on its own Redis connection. `workflow.cancel` is consumed by one
 * processor of the consumer group, so with workers on both replicas it may not be the processor
 * running the step: the abort has to reach that step through the run's control topic.
 */
describe('evented workflow: remote cancel over RedisStreamsPubSub', () => {
  const pubsubs: RedisStreamsPubSub[] = [];
  const instances: Mastra[] = [];

  afterEach(async () => {
    vi.restoreAllMocks();
    await Promise.allSettled(instances.splice(0).map(m => m.stopWorkers()));
    await Promise.allSettled(pubsubs.splice(0).map(p => p.close()));
  });

  const cases = [
    { shape: 'sequential', canceller: 'other', workersOnBoth: false },
    { shape: 'dountil', canceller: 'other', workersOnBoth: false },
    { shape: 'sequential', canceller: 'other', workersOnBoth: true },
    { shape: 'sequential', canceller: 'owner', workersOnBoth: true },
    { shape: 'dountil', canceller: 'other', workersOnBoth: true },
    { shape: 'nested', canceller: 'other', workersOnBoth: true },
    { shape: 'nested', canceller: 'owner', workersOnBoth: true },
  ] as const;

  for (const { shape, canceller, workersOnBoth } of cases) {
    it(`settles canceled and aborts the step (${shape}, cancel from ${canceller}, workers on ${workersOnBoth ? 'both replicas' : 'owner only'})`, async () => {
      let blocker = createBlocker();
      const ranOn: Label[] = [];

      const buildWorkflow = (label: Label) => {
        const countSchema = z.object({ count: z.number() });
        const blocking = createStep({
          id: 'blocking',
          inputSchema: countSchema,
          outputSchema: countSchema,
          execute: async ({ inputData, abortSignal }) => {
            if (blocker.calls === 0) ranOn.push(label);
            await blocker.block(abortSignal);
            return { count: inputData.count + 1 };
          },
        });
        const workflow = createWorkflow({ id: WORKFLOW_ID, inputSchema: countSchema, outputSchema: countSchema });
        if (shape === 'dountil') {
          return workflow.dountil(blocking, async ({ inputData }) => inputData.count >= 3).commit();
        }
        if (shape === 'nested') {
          const child = createWorkflow({
            id: `${WORKFLOW_ID}-child`,
            inputSchema: countSchema,
            outputSchema: countSchema,
          })
            .then(blocking)
            .commit();
          return workflow.then(child).commit();
        }
        return workflow.then(blocking).commit();
      };

      const storage = new InMemoryStore();
      const keyPrefix = `remote-cancel-${randomUUID()}`;
      const controlSubscriptions = new Map<string, number>();
      const ends = new Map<string, number>();
      const createInstance = (label: Label) => {
        const pubsub = new RedisStreamsPubSub({ url: REDIS_URL, keyPrefix, blockMs: 200 });
        pubsubs.push(pubsub);
        trackPubSub(pubsub, controlSubscriptions, ends);
        const mastra = new Mastra({
          logger: false,
          storage,
          pubsub,
          workflows: { [WORKFLOW_ID]: buildWorkflow(label) },
        });
        instances.push(mastra);
        return mastra;
      };
      const owner = createInstance('owner');
      const other = createInstance('other');
      await owner.startWorkers();
      if (workersOnBoth) await other.startWorkers();

      for (let i = 0; i < RUNS; i++) {
        blocker = createBlocker();
        const runId = randomUUID();
        const ownerRun = await owner.getWorkflow(WORKFLOW_ID).createRun({ runId });
        const resultPromise = ownerRun.start({ inputData: { count: 0 } });
        await blocker.entered;

        const cancelling = canceller === 'owner' ? owner : other;
        await (await cancelling.getWorkflow(WORKFLOW_ID).createRun({ runId })).cancel();

        const result = await Promise.race([
          resultPromise,
          new Promise<{ status: string }>(resolve => setTimeout(() => resolve({ status: 'timed out' }), 8_000)),
        ]);
        expect(result.status).toBe('canceled');
        await vi.waitFor(() => expect(blocker.aborted).toBe(true), { timeout: 5_000 });
        await vi.waitFor(
          () => {
            for (const [topic, count] of controlSubscriptions) expect({ topic, count }).toEqual({ topic, count: 0 });
          },
          { timeout: 5_000 },
        );
        await new Promise(resolve => setTimeout(resolve, 200));
        expect(ends.get(runId)).toBe(1);
      }

      expect(controlSubscriptions.size).toBeGreaterThan(0);
      if (workersOnBoth) expect(ranOn).toContain('other');
    }, 60_000);
  }
});

function createBlocker() {
  let markEntered!: () => void;
  const blocker = {
    calls: 0,
    aborted: false,
    entered: new Promise<void>(resolve => (markEntered = resolve)),
    block: async (abortSignal: AbortSignal) => {
      blocker.calls++;
      if (blocker.calls !== 1) return;
      markEntered();
      await new Promise<void>(resolve => {
        const timer = setTimeout(resolve, 10_000);
        abortSignal.addEventListener('abort', () => {
          blocker.aborted = true;
          clearTimeout(timer);
          resolve();
        });
      });
    },
  };
  return blocker;
}

/** Counts net control-topic subscriptions and top-level `workflow.end` publishes per run. */
function trackPubSub(pubsub: RedisStreamsPubSub, controlSubscriptions: Map<string, number>, ends: Map<string, number>) {
  const subscribe = pubsub.subscribe.bind(pubsub);
  const unsubscribe = pubsub.unsubscribe.bind(pubsub);
  const publish = pubsub.publish.bind(pubsub);
  vi.spyOn(pubsub, 'subscribe').mockImplementation(async (topic, cb, options) => {
    await subscribe(topic, cb, options);
    if (topic.startsWith('workflow.control.')) {
      controlSubscriptions.set(topic, (controlSubscriptions.get(topic) ?? 0) + 1);
    }
  });
  vi.spyOn(pubsub, 'unsubscribe').mockImplementation(async (topic, cb) => {
    await unsubscribe(topic, cb);
    if (topic.startsWith('workflow.control.')) {
      controlSubscriptions.set(topic, (controlSubscriptions.get(topic) ?? 0) - 1);
    }
  });
  vi.spyOn(pubsub, 'publish').mockImplementation(async (topic, event, ...rest) => {
    if (topic === 'workflows' && event.type === 'workflow.end' && !event.data?.parentWorkflow) {
      ends.set(event.runId, (ends.get(event.runId) ?? 0) + 1);
    }
    return (publish as (...args: unknown[]) => Promise<void>)(topic, event, ...rest);
  });
}
