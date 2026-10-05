import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { EventEmitterPubSub } from '../../events/event-emitter';
import { Mastra } from '../../mastra';
import { RequestContext } from '../../request-context';
import { MockStore } from '../../storage/mock';
import { createStep, createWorkflow } from '.';

function createApprovalWorkflow() {
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

  return { approval, downstreamExecute, mastra, storage, workflow };
}

describe('evented concurrent resume', () => {
  it('allows only one caller to resume the same suspension', async () => {
    const { approval, downstreamExecute, mastra, storage, workflow } = createApprovalWorkflow();

    await mastra.startWorkers();
    try {
      const run = await workflow.createRun();
      const startResult = await run.start({ inputData: { item: 'widget' } });
      expect(startResult.status).toBe('suspended');

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
        run.resume({ step: approval, resumeData: { approvedBy: 'first' } }),
        run.resume({ step: approval, resumeData: { approvedBy: 'second' } }),
      ]);
      loadSpy.mockRestore();

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

  it('allows only one nested child to resume the suspended parent at a time', async () => {
    let alphaResumeStarted!: () => void;
    const alphaResumeHasStarted = new Promise<void>(resolve => {
      alphaResumeStarted = resolve;
    });
    let releaseAlphaResume!: () => void;
    const alphaResumeReleased = new Promise<void>(resolve => {
      releaseAlphaResume = resolve;
    });

    const childStep = createStep({
      id: 'approval-step',
      inputSchema: z.object({ item: z.string() }),
      outputSchema: z.string(),
      resumeSchema: z.object({ approved: z.boolean() }),
      execute: async ({ inputData, resumeData, suspend }) => {
        if (!resumeData) {
          await suspend({ item: inputData.item });
        }
        if (resumeData && inputData.item === 'alpha') {
          alphaResumeStarted();
          await alphaResumeReleased;
        }
        return inputData.item;
      },
    });
    const childWorkflow = createWorkflow({
      id: 'evented-concurrent-child-workflow',
      inputSchema: z.object({ item: z.string() }),
      outputSchema: z.string(),
    })
      .then(childStep)
      .commit();
    const parentWorkflow = createWorkflow({
      id: 'evented-concurrent-parent-workflow',
      inputSchema: z.array(z.object({ item: z.string() })),
      outputSchema: z.array(z.string()),
    })
      .foreach(childWorkflow, { concurrency: 2 })
      .commit();
    const storage = new MockStore();
    const mastra = new Mastra({
      logger: false,
      storage,
      pubsub: new EventEmitterPubSub(),
      workflows: { [parentWorkflow.id]: parentWorkflow, [childWorkflow.id]: childWorkflow },
    });

    await mastra.startWorkers();
    try {
      const parentRun = await parentWorkflow.createRun();
      const parentStart = parentRun.start({ inputData: [{ item: 'alpha' }, { item: 'beta' }] });
      expect(
        await Promise.race([
          parentStart,
          new Promise((_, reject) => setTimeout(() => reject(new Error('parent start did not suspend')), 5_000)),
        ]),
      ).toMatchObject({ status: 'suspended' });

      const workflowsStore = (await storage.getStore('workflows'))!;
      const parentSnapshot = await workflowsStore.loadWorkflowSnapshot({
        workflowName: parentWorkflow.id,
        runId: parentRun.runId,
      });
      const iterations = (parentSnapshot?.context?.[childWorkflow.id] as any)?.output ?? [];
      const nestedRunIds = iterations.map(
        (iteration: { suspendPayload?: { __workflow_meta?: { runId?: string } } }) =>
          iteration.suspendPayload?.__workflow_meta?.runId,
      ) as string[];
      expect(nestedRunIds).toEqual([expect.any(String), expect.any(String)]);

      const childRuns = await Promise.all(nestedRunIds.map(runId => childWorkflow.createRun({ runId })));
      const alphaResume = childRuns[0]!.resume({ resumeData: { approved: true } });
      await Promise.race([
        alphaResumeHasStarted,
        new Promise((_, reject) => setTimeout(() => reject(new Error('alpha resume did not start')), 5_000)),
      ]);

      await expect(childRuns[1]!.resume({ resumeData: { approved: true } })).rejects.toMatchObject({
        id: 'WORKFLOW_RESUME_ALREADY_CLAIMED',
      });
      expect(
        await workflowsStore.loadWorkflowSnapshot({ workflowName: childWorkflow.id, runId: nestedRunIds[1]! }),
      ).toMatchObject({ status: 'suspended' });

      releaseAlphaResume();
      await expect(alphaResume).resolves.toMatchObject({ status: 'success' });
      await expect
        .poll(async () => {
          const snapshot = await workflowsStore.loadWorkflowSnapshot({
            workflowName: parentWorkflow.id,
            runId: parentRun.runId,
          });
          return snapshot?.status;
        })
        .toBe('suspended');

      await expect(childRuns[1]!.resume({ resumeData: { approved: true } })).resolves.toMatchObject({
        status: 'success',
      });
      await expect
        .poll(async () => {
          const snapshot = await workflowsStore.loadWorkflowSnapshot({
            workflowName: parentWorkflow.id,
            runId: parentRun.runId,
          });
          return snapshot?.status;
        })
        .toBe('success');
    } finally {
      releaseAlphaResume();
      await mastra.stopWorkers();
    }
  });

  it('requires permission to execute the parent before directly resuming a nested child', async () => {
    const childStep = createStep({
      id: 'approval-step',
      inputSchema: z.object({ item: z.string() }),
      outputSchema: z.string(),
      resumeSchema: z.object({ approved: z.boolean() }),
      execute: async ({ inputData, resumeData, suspend }) => {
        if (!resumeData) await suspend({ item: inputData.item });
        return inputData.item;
      },
    });
    const childWorkflow = createWorkflow({
      id: 'evented-authorized-child-workflow',
      inputSchema: z.object({ item: z.string() }),
      outputSchema: z.string(),
    })
      .then(childStep)
      .commit();
    const parentWorkflow = createWorkflow({
      id: 'evented-unauthorized-parent-workflow',
      inputSchema: z.object({ item: z.string() }),
      outputSchema: z.string(),
    })
      .then(childWorkflow)
      .commit();
    const storage = new MockStore();
    const fgaProvider = {
      require: vi.fn(async (_user, { resource }: { resource: { id: string } }) => {
        if (resource.id === parentWorkflow.id) throw new Error('parent execution denied');
      }),
      check: vi.fn(),
      filterAccessible: vi.fn(),
    };
    const mastra = new Mastra({
      logger: false,
      storage,
      pubsub: new EventEmitterPubSub(),
      workflows: { [parentWorkflow.id]: parentWorkflow, [childWorkflow.id]: childWorkflow },
      server: { fga: fgaProvider },
    });

    await mastra.startWorkers();
    try {
      const parentRun = await parentWorkflow.createRun({ resourceId: 'tenant-1' });
      await expect(
        parentRun.start({
          inputData: { item: 'widget' },
          actor: { actorKind: 'system', sourceWorkflow: 'test-setup' },
        }),
      ).resolves.toMatchObject({ status: 'suspended' });

      const workflowsStore = (await storage.getStore('workflows'))!;
      const parentSnapshot = await workflowsStore.loadWorkflowSnapshot({
        workflowName: parentWorkflow.id,
        runId: parentRun.runId,
      });
      const childRunId = (parentSnapshot?.context?.[childWorkflow.id] as any)?.suspendPayload?.__workflow_meta?.runId;
      expect(childRunId).toEqual(expect.any(String));

      const childRun = await childWorkflow.createRun({ runId: childRunId, resourceId: 'tenant-1' });
      const requestContext = new RequestContext();
      requestContext.set('user', { id: 'user-1' });

      await expect(childRun.resume({ resumeData: { approved: true }, requestContext })).rejects.toThrow(
        'parent execution denied',
      );
      expect(fgaProvider.require).toHaveBeenCalledTimes(2);
      expect(fgaProvider.require).toHaveBeenLastCalledWith(
        { id: 'user-1' },
        expect.objectContaining({
          resource: { type: 'workflow', id: parentWorkflow.id },
          permission: 'workflows:execute',
          context: expect.objectContaining({ resourceId: 'tenant-1', requestContext }),
        }),
      );
      await expect(
        workflowsStore.loadWorkflowSnapshot({ workflowName: childWorkflow.id, runId: childRunId }),
      ).resolves.toMatchObject({ status: 'suspended' });
      await expect(
        workflowsStore.loadWorkflowSnapshot({ workflowName: parentWorkflow.id, runId: parentRun.runId }),
      ).resolves.toMatchObject({ status: 'suspended' });
    } finally {
      await mastra.stopWorkers();
    }
  });

  it('releases the resume claim when execution fails before dispatch', async () => {
    const { approval, downstreamExecute, mastra, storage, workflow } = createApprovalWorkflow();

    await mastra.startWorkers();
    try {
      const run = await workflow.createRun();
      const startResult = await run.start({ inputData: { item: 'widget' } });
      expect(startResult.status).toBe('suspended');

      const executeSpy = vi
        .spyOn((run as any).executionEngine, 'execute')
        .mockRejectedValueOnce(new Error('publish boom'));
      await expect(run.resume({ step: approval, resumeData: { approvedBy: 'first' } })).rejects.toThrow('publish boom');
      executeSpy.mockRestore();

      const workflowsStore = (await storage.getStore('workflows'))!;
      const snapshot = await workflowsStore.loadWorkflowSnapshot({
        workflowName: workflow.id,
        runId: run.runId,
      });
      expect(snapshot?.status).toBe('suspended');

      const result = await run.resume({ step: approval, resumeData: { approvedBy: 'second' } });
      expect(result.status).toBe('success');
      expect(downstreamExecute).toHaveBeenCalledTimes(1);
    } finally {
      await mastra.stopWorkers();
    }
  });
});
