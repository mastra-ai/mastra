import { randomUUID } from 'node:crypto';
import { Mastra } from '@mastra/core/mastra';
import { InMemoryStore } from '@mastra/core/storage';
import { createStep, createWorkflow, WorkflowEventProcessor } from '@mastra/core/workflows/evented';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { RedisStreamsPubSub } from './index';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6381';

// A store error used to fail all three deliveries of an event within milliseconds on Redis
// Streams, because a nack republishes the event at once. The engine now waits before each
// retry (about 0.5-1 s, then 2-4 s), so an outage shorter than that no longer fails the run.
describe('evented delivery retries on Redis Streams', () => {
  let mastra: Mastra | undefined;
  let pubsub: RedisStreamsPubSub | undefined;

  afterEach(async () => {
    await mastra?.stopWorkers();
    await pubsub?.close();
    vi.restoreAllMocks();
  });

  it('a run survives a 2 s database outage', async () => {
    const workflowId = `outage-${randomUUID()}`;
    let outageStart = 0;
    const workflow = createWorkflow({ id: workflowId, inputSchema: z.object({}), outputSchema: z.object({}) })
      .then(
        createStep({
          id: 'first',
          inputSchema: z.object({}),
          outputSchema: z.object({}),
          execute: async () => {
            outageStart = Date.now();
            return {};
          },
        }),
      )
      .then(
        createStep({ id: 'second', inputSchema: z.object({}), outputSchema: z.object({}), execute: async () => ({}) }),
      )
      .commit();
    const storage = new InMemoryStore();
    const workflows = (await storage.getStore('workflows'))!;
    const load = workflows.loadWorkflowSnapshot.bind(workflows);
    // Down for 2.2 s from step "first": the step.end delivery and its first retry fail, the
    // second retry succeeds.
    workflows.loadWorkflowSnapshot = async args => {
      if (outageStart && Date.now() < outageStart + 2_200) throw new Error('Connection terminated unexpectedly');
      return load(args);
    };
    pubsub = new RedisStreamsPubSub({ url: REDIS_URL, keyPrefix: workflowId, blockMs: 50 });
    mastra = new Mastra({ workflows: { workflow }, storage, pubsub, logger: false });
    await mastra.startWorkers('orchestration');
    const original = WorkflowEventProcessor.prototype.handle;
    const arrivals = new Map<object, number>();
    const deliveries = vi
      .spyOn(WorkflowEventProcessor.prototype, 'handle')
      .mockImplementation(function (this: WorkflowEventProcessor, event) {
        arrivals.set(event, Date.now());
        return original.call(this, event);
      });
    const run = await mastra.getWorkflow('workflow').createRun();
    const result = await Promise.race([
      run.start({ inputData: {} }),
      new Promise<{ status: 'HANG' }>(resolve => setTimeout(() => resolve({ status: 'HANG' }), 15_000)),
    ]);

    const stepEnds = deliveries.mock.calls
      .map(([event]) => event)
      .filter(event => event.runId === run.runId && event.type === 'workflow.step.end');
    const firstStepEnd = stepEnds.filter(event => event.id === stepEnds[0]!.id);
    const at = firstStepEnd.map(event => arrivals.get(event)!);
    expect(result.status).toBe('success');
    expect(firstStepEnd.map(event => event.deliveryAttempt)).toEqual([1, 2, 3]);
    expect(at[1]! - at[0]!).toBeGreaterThanOrEqual(450);
    expect(at[2]! - at[1]!).toBeGreaterThanOrEqual(1_900);
  }, 20_000);
});
