import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { EventEmitterPubSub } from '../../events/event-emitter';
import { Mastra } from '../../mastra';
import { MockStore } from '../../storage/mock';
import { createStep, createWorkflow } from '.';

// See https://github.com/mastra-ai/mastra/issues/27279.
function createTimeTravelWorkflow() {
  const storage = new MockStore();
  const pubsub = new EventEmitterPubSub();
  const workExecute = vi.fn(async () => ({}));

  const work = createStep({
    id: 'work',
    inputSchema: z.object({}),
    outputSchema: z.object({}),
    execute: workExecute,
  });

  const wait = createStep({
    id: 'wait',
    inputSchema: z.object({}),
    outputSchema: z.object({}),
    resumeSchema: z.object({ ok: z.boolean() }),
    execute: async ({ resumeData, suspend }) => {
      if (!resumeData) {
        await suspend({});
      }
      return {};
    },
  });

  const workflow = createWorkflow({
    id: 'evented-concurrent-time-travel',
    inputSchema: z.object({}),
    outputSchema: z.object({}),
    steps: [work, wait],
  })
    .then(work)
    .then(wait)
    .commit();

  const mastra = new Mastra({
    logger: false,
    storage,
    pubsub,
    workflows: { [workflow.id]: workflow },
  });

  return { workExecute, mastra, storage, workflow };
}

describe('evented concurrent time travel', () => {
  it('allows only one caller to time travel the same run', async () => {
    const { workExecute, mastra, storage, workflow } = createTimeTravelWorkflow();

    await mastra.startWorkers();
    try {
      const run = await workflow.createRun();
      expect((await run.start({ inputData: {} })).status).toBe('suspended');
      workExecute.mockClear();

      // Hold both callers after they read the snapshot so the compare-and-set decides the winner.
      const workflowsStore = (await storage.getStore('workflows'))!;
      const loadWorkflowSnapshot = workflowsStore.loadWorkflowSnapshot.bind(workflowsStore);
      let loadedSnapshots = 0;
      let releaseLoads!: () => void;
      const bothCallersLoaded = new Promise<void>(resolve => {
        releaseLoads = resolve;
      });
      const loadSpy = vi.spyOn(workflowsStore, 'loadWorkflowSnapshot').mockImplementation(async args => {
        const snapshot = await loadWorkflowSnapshot(args);
        if (loadedSnapshots < 2) {
          loadedSnapshots += 1;
          if (loadedSnapshots === 2) releaseLoads();
          await bothCallersLoaded;
        }
        return snapshot;
      });

      const results = await Promise.allSettled([
        run.timeTravel({ step: 'work', inputData: {} }),
        run.timeTravel({ step: 'work', inputData: {} }),
      ]);
      loadSpy.mockRestore();

      const fulfilled = results.filter(result => result.status === 'fulfilled');
      const rejected = results.filter(result => result.status === 'rejected');

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect((fulfilled[0] as PromiseFulfilledResult<any>).value.status).toBe('suspended');
      expect((rejected[0] as PromiseRejectedResult).reason.id).toBe('WORKFLOW_TIME_TRAVEL_ALREADY_CLAIMED');
      expect(workExecute).toHaveBeenCalledTimes(1);
    } finally {
      await mastra.stopWorkers();
    }
  });

  it('allows a second time travel after the first one finishes', async () => {
    const { workExecute, mastra, workflow } = createTimeTravelWorkflow();

    await mastra.startWorkers();
    try {
      const run = await workflow.createRun();
      expect((await run.start({ inputData: {} })).status).toBe('suspended');
      workExecute.mockClear();

      expect((await run.timeTravel({ step: 'work', inputData: {} })).status).toBe('suspended');
      expect((await run.timeTravel({ step: 'work', inputData: {} })).status).toBe('suspended');
      expect(workExecute).toHaveBeenCalledTimes(2);
    } finally {
      await mastra.stopWorkers();
    }
  });
});
