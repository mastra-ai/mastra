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

      const abortSetupSpy = vi.spyOn(run as any, 'setupAbortHandler').mockImplementationOnce(() => {
        throw new Error('abort setup boom');
      });
      await expect(run.resume({ step: approval, resumeData: { approvedBy: 'failed-setup' } })).rejects.toThrow(
        'abort setup boom',
      );
      abortSetupSpy.mockRestore();

      const workflowsStore = (await storage.getStore('workflows'))!;
      const afterSetupFailure = await workflowsStore.loadWorkflowSnapshot({
        workflowName: workflow.id,
        runId: run.runId,
      });
      expect(afterSetupFailure?.status).toBe('suspended');

      const executeSpy = vi
        .spyOn((run as any).executionEngine, 'execute')
        .mockRejectedValueOnce(new Error('publish boom'));
      await expect(run.resume({ step: approval, resumeData: { approvedBy: 'failed-publish' } })).rejects.toThrow(
        'publish boom',
      );
      executeSpy.mockRestore();

      const afterPublishFailure = await workflowsStore.loadWorkflowSnapshot({
        workflowName: workflow.id,
        runId: run.runId,
      });
      expect(afterPublishFailure?.status).toBe('suspended');

      const startedExecuteSpy = vi.spyOn((run as any).executionEngine, 'execute').mockImplementationOnce(async () => {
        await workflowsStore.updateWorkflowState({
          workflowName: workflow.id,
          runId: run.runId,
          opts: { status: 'running', expectedStatus: 'pending' },
        });
        throw new Error('engine failed after start');
      });
      await expect(run.resume({ step: approval, resumeData: { approvedBy: 'started' } })).rejects.toThrow(
        'engine failed after start',
      );
      startedExecuteSpy.mockRestore();

      const afterStartedFailure = await workflowsStore.loadWorkflowSnapshot({
        workflowName: workflow.id,
        runId: run.runId,
      });
      expect(afterStartedFailure?.status).toBe('running');
      await workflowsStore.updateWorkflowState({
        workflowName: workflow.id,
        runId: run.runId,
        opts: { status: 'suspended', expectedStatus: 'running' },
      });

      const updateWorkflowState = workflowsStore.updateWorkflowState.bind(workflowsStore);
      let claimAttempts = 0;
      let releaseClaims!: () => void;
      const bothClaimsStarted = new Promise<void>(resolve => {
        releaseClaims = resolve;
      });
      const updateSpy = vi.spyOn(workflowsStore, 'updateWorkflowState').mockImplementation(async args => {
        if (args.opts.expectedStatus === 'suspended') {
          claimAttempts += 1;
          if (claimAttempts === 2) releaseClaims();
          await bothClaimsStarted;
        }
        return updateWorkflowState(args);
      });

      const results = await Promise.allSettled([
        run.resume({ step: approval, resumeData: { approvedBy: 'first' } }),
        run.resume({ step: approval, resumeData: { approvedBy: 'second' } }),
      ]);

      updateSpy.mockRestore();
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

  it('resumes multiple suspended branches sequentially', async () => {
    const storage = new MockStore();
    const pubsub = new EventEmitterPubSub();
    const createApproval = (id: string) =>
      createStep({
        id,
        inputSchema: z.object({ item: z.string() }),
        outputSchema: z.object({ item: z.string(), approvedBy: z.string() }),
        suspendSchema: z.object({ reason: z.string() }),
        resumeSchema: z.object({ approvedBy: z.string() }),
        execute: async ({ inputData, resumeData, suspend }) => {
          if (!resumeData) {
            await suspend({ reason: `Needs approval: ${id}` });
            return { item: inputData.item, approvedBy: '' };
          }
          return { item: inputData.item, approvedBy: resumeData.approvedBy };
        },
      });
    const firstApproval = createApproval('first-approval');
    const secondApproval = createApproval('second-approval');
    const workflow = createWorkflow({
      id: 'evented-sequential-multi-resume',
      inputSchema: z.object({ item: z.string() }),
      outputSchema: z.array(z.object({ item: z.string(), approvedBy: z.string() })),
      steps: [firstApproval, secondApproval],
    })
      .parallel([firstApproval, secondApproval])
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

      const firstResult = await run.resume({
        step: firstApproval,
        resumeData: { approvedBy: 'Ada' },
      });
      expect(firstResult.status).toBe('suspended');

      const secondResult = await run.resume({
        step: secondApproval,
        resumeData: { approvedBy: 'Grace' },
      });
      expect(secondResult.status).toBe('success');
    } finally {
      await mastra.stopWorkers();
    }
  });

  it('skips the durable claim when pending snapshots are filtered out', async () => {
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
      id: 'evented-filtered-resume-claim',
      inputSchema: z.object({ item: z.string() }),
      outputSchema: z.object({ completed: z.boolean() }),
      steps: [approval, downstream],
      options: {
        shouldPersistSnapshot: ({ workflowStatus }) => workflowStatus !== 'pending',
      },
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

      const workflowsStore = (await storage.getStore('workflows'))!;
      const updateSpy = vi.spyOn(workflowsStore, 'updateWorkflowState');
      const result = await run.resume({ step: approval, resumeData: { approvedBy: 'Ada' } });

      expect(result.status).toBe('success');
      expect(downstreamExecute).toHaveBeenCalledTimes(1);
      expect(
        updateSpy.mock.calls.some(
          ([args]) => args.opts.status === 'pending' && args.opts.expectedStatus === 'suspended',
        ),
      ).toBe(false);
    } finally {
      await mastra.stopWorkers();
    }
  });
});
