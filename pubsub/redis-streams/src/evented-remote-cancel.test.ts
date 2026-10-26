import { randomUUID } from 'node:crypto';
import { Mastra } from '@mastra/core/mastra';
import { InMemoryStore } from '@mastra/core/storage';
import { createStep, createWorkflow } from '@mastra/core/workflows/evented';
import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { RedisStreamsPubSub } from './index';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6381';
const WORKFLOW_ID = 'redis-remote-cancel';

/**
 * Cancelling an evented run from a replica that does not own it must settle the owner's
 * `run.start()` as `canceled`, with each replica on its own Redis connection.
 */
describe('evented workflow: remote cancel over RedisStreamsPubSub', () => {
  const pubsubs: RedisStreamsPubSub[] = [];
  const instances: Mastra[] = [];

  afterEach(async () => {
    await Promise.allSettled(instances.splice(0).map(m => m.stopWorkers()));
    await Promise.allSettled(pubsubs.splice(0).map(p => p.close()));
  });

  // With workers on both replicas, workflow.cancel is consumed by one of them, which may not be the
  // processor running the step, so step abort is only asserted when the owner is the sole worker.
  const cases = [
    { shape: 'sequential', workersOnBoth: false },
    { shape: 'dountil', workersOnBoth: false },
    { shape: 'sequential', workersOnBoth: true },
    { shape: 'dountil', workersOnBoth: true },
  ] as const;

  for (const { shape, workersOnBoth } of cases) {
    it(`settles the owner's start() as canceled (${shape}, workers on ${workersOnBoth ? 'both replicas' : 'owner only'})`, async () => {
      let markEntered!: () => void;
      const entered = new Promise<void>(resolve => (markEntered = resolve));
      let calls = 0;
      let stepAborted = false;

      const buildWorkflow = () => {
        const blocking = createStep({
          id: 'blocking',
          inputSchema: z.object({ count: z.number() }),
          outputSchema: z.object({ count: z.number() }),
          execute: async ({ inputData, abortSignal }) => {
            calls++;
            if (calls === 1) {
              markEntered();
              await new Promise<void>(resolve => {
                const timer = setTimeout(resolve, 10_000);
                abortSignal.addEventListener('abort', () => {
                  stepAborted = true;
                  clearTimeout(timer);
                  resolve();
                });
              });
            }
            return { count: inputData.count + 1 };
          },
        });
        const workflow = createWorkflow({
          id: WORKFLOW_ID,
          inputSchema: z.object({ count: z.number() }),
          outputSchema: z.object({ count: z.number() }),
        });
        return shape === 'dountil'
          ? workflow.dountil(blocking, async ({ inputData }) => inputData.count >= 3).commit()
          : workflow.then(blocking).commit();
      };

      const storage = new InMemoryStore();
      const keyPrefix = `remote-cancel-${randomUUID()}`;
      const createInstance = () => {
        const pubsub = new RedisStreamsPubSub({ url: REDIS_URL, keyPrefix, blockMs: 200 });
        pubsubs.push(pubsub);
        const mastra = new Mastra({ logger: false, storage, pubsub, workflows: { [WORKFLOW_ID]: buildWorkflow() } });
        instances.push(mastra);
        return mastra;
      };
      const owner = createInstance();
      const other = createInstance();
      await owner.startWorkers();
      if (workersOnBoth) await other.startWorkers();

      const runId = randomUUID();
      const ownerRun = await owner.getWorkflow(WORKFLOW_ID).createRun({ runId });
      const resultPromise = ownerRun.start({ inputData: { count: 0 } });
      await entered;

      const otherRun = await other.getWorkflow(WORKFLOW_ID).createRun({ runId });
      await otherRun.cancel();

      const result = await Promise.race([
        resultPromise,
        new Promise<{ status: string }>(resolve => setTimeout(() => resolve({ status: 'timed out' }), 8_000)),
      ]);
      expect(result.status).toBe('canceled');
      if (!workersOnBoth) expect(stepAborted).toBe(true);
    }, 20_000);
  }
});
