import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { EventEmitterPubSub } from '../../events/event-emitter';
import { Mastra } from '../../mastra';
import { MockStore } from '../../storage/mock';
import { createStep, createWorkflow } from '.';

describe('evented concurrent resume', () => {
  it('runs downstream steps once when two resume calls race', async () => {
    const storage = new MockStore();
    const pubsub = new EventEmitterPubSub();
    const downstreamExecute = vi.fn(async () => ({ completed: true }));

    const approval = createStep({
      id: 'approval',
      inputSchema: z.object({ item: z.string() }),
      outputSchema: z.object({ item: z.string(), approvedBy: z.string() }),
      suspendSchema: z.object({ reason: z.string() }),
      resumeSchema: z.object({ approvedBy: z.string() }),
      execute: async ({ inputData, resumeData, suspend }) => {
        if (!resumeData) {
          await suspend({ reason: `Needs approval: ${inputData.item}` });
          return { item: inputData.item, approvedBy: '' };
        }

        return { item: inputData.item, approvedBy: resumeData.approvedBy };
      },
    });

    const downstream = createStep({
      id: 'downstream',
      inputSchema: z.object({ item: z.string(), approvedBy: z.string() }),
      outputSchema: z.object({ completed: z.boolean() }),
      execute: downstreamExecute,
    });

    const workflow = createWorkflow({
      id: 'evented-concurrent-resume',
      inputSchema: z.object({ item: z.string() }),
      outputSchema: z.object({ completed: z.boolean() }),
      steps: [approval, downstream],
    })
      .then(approval)
      .then(downstream)
      .commit();

    const mastra = new Mastra({
      logger: false,
      storage,
      pubsub,
      workflows: { [workflow.id]: workflow },
    });

    await mastra.startWorkers();
    try {
      const run = await workflow.createRun();
      const startResult = await run.start({ inputData: { item: 'widget' } });
      expect(startResult.status).toBe('suspended');

      const executeSpy = vi
        .spyOn((run as any).executionEngine, 'execute')
        .mockRejectedValueOnce(new Error('engine boom'));
      await expect(run.resume({ step: approval, resumeData: { approvedBy: 'failed' } })).rejects.toThrow('engine boom');
      executeSpy.mockRestore();

      const results = await Promise.allSettled([
        run.resume({ step: approval, resumeData: { approvedBy: 'first' } }),
        run.resume({ step: approval, resumeData: { approvedBy: 'second' } }),
      ]);

      const fulfilled = results.filter(result => result.status === 'fulfilled');
      const rejected = results.filter(result => result.status === 'rejected');

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect((fulfilled[0] as PromiseFulfilledResult<any>).value.status).toBe('success');
      expect((rejected[0] as PromiseRejectedResult).reason.id).toBe('WORKFLOW_RESUME_ALREADY_CLAIMED');
      expect(downstreamExecute).toHaveBeenCalledTimes(1);
    } finally {
      await mastra.stopWorkers();
    }
  });
});
