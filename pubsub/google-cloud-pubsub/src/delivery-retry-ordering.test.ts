import { randomUUID } from 'node:crypto';
import { Mastra } from '@mastra/core/mastra';
import { MockStore } from '@mastra/core/storage';
import { OrchestrationWorker } from '@mastra/core/worker';
import { createStep, createWorkflow } from '@mastra/core/workflows/evented';
import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { GoogleCloudPubSub } from '.';

const EMULATOR_HOST = process.env.PUBSUB_EMULATOR_HOST ?? 'localhost:8085';

// The evented engine waits 0.5-1 s, then 2-4 s, before nacking a failed delivery. Every
// workflow event shares one ordering key with ordered delivery on, so this checks that a
// delivery held for that wait does not hold back other runs' events on the same key.
describe('evented delivery retries on Google Cloud Pub/Sub', () => {
  let mastra: Mastra | undefined;

  afterEach(async () => {
    await mastra?.stopWorkers();
  });

  it('a run whose database is down does not hold up other runs while it waits to retry', async () => {
    const workflowId = `ordering-${randomUUID()}`;
    let brokenRunId: string | undefined;
    let outage = false;
    const workflow = createWorkflow({ id: workflowId, inputSchema: z.object({}), outputSchema: z.object({}) })
      .then(
        createStep({
          id: 'first',
          inputSchema: z.object({}),
          outputSchema: z.object({}),
          execute: async ({ runId }) => {
            if (runId === brokenRunId) outage = true;
            return {};
          },
        }),
      )
      .then(
        createStep({ id: 'second', inputSchema: z.object({}), outputSchema: z.object({}), execute: async () => ({}) }),
      )
      .commit();
    const storage = new MockStore();
    const workflows = (await storage.getStore('workflows'))!;
    const load = workflows.loadWorkflowSnapshot.bind(workflows);
    const failures: number[] = [];
    let notifyFailure: (() => void) | undefined;
    const firstFailure = new Promise<void>(resolve => (notifyFailure = resolve));
    workflows.loadWorkflowSnapshot = async args => {
      if (outage && args.runId === brokenRunId) {
        failures.push(Date.now());
        notifyFailure?.();
        throw new Error('Connection terminated unexpectedly');
      }
      return load(args);
    };
    const pubsub = new GoogleCloudPubSub({ projectId: 'pubsub-test', apiEndpoint: EMULATOR_HOST });
    // Its own subscription, so messages another test process left on the emulator's shared
    // orchestration subscription can't stall this one.
    mastra = new Mastra({
      workflows: { [workflowId]: workflow },
      storage,
      pubsub,
      logger: false,
      workers: [new OrchestrationWorker({ group: workflowId })],
    });
    await mastra.startWorkers();

    const broken = await workflow.createRun();
    brokenRunId = broken.runId;
    const brokenResult = broken.start({ inputData: {} });
    await firstFailure;

    const healthy = await workflow.createRun();
    const result = await Promise.race([
      healthy.start({ inputData: {} }),
      new Promise<{ status: 'HANG' }>(resolve => setTimeout(() => resolve({ status: 'HANG' }), 10_000)),
    ]);
    const healthyDoneAt = Date.now();
    // The store recovers, so the broken run's next retry succeeds and leaves nothing unacked.
    outage = false;
    const brokenSettled = await Promise.race([
      brokenResult,
      new Promise<{ status: 'HANG' }>(resolve => setTimeout(() => resolve({ status: 'HANG' }), 15_000)),
    ]);

    expect(result.status).toBe('success');
    expect(brokenSettled.status).toBe('success');
    // About 1 s on the emulator. Events held behind the broken run's waits would take 2.5 s
    // or more.
    expect(healthyDoneAt - failures[0]!).toBeLessThan(2_000);
  }, 40_000);
});
