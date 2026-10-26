import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { Mastra } from '../mastra';
import { WorkflowsInMemory } from '../storage/domains/workflows/inmemory';
import { MockStore } from '../storage/mock';
import { createWorkflow } from './create';
import { createStep } from './workflow';

// Regression coverage for https://github.com/mastra-ai/mastra/issues/27805
// A run canceled through another Mastra instance that shares storage (e.g. a second process)
// must stop before its next step and keep the persisted `canceled` status.
describe('cancel() from another Mastra instance sharing storage', () => {
  const workflowId = 'cancel-remote-run';

  const buildWorkflow = (hooks: { firstStep?: () => Promise<void>; laterStep?: () => void }) =>
    createWorkflow({
      id: workflowId,
      inputSchema: z.object({}),
      outputSchema: z.object({}),
      options: { validateInputs: false },
    })
      .then(
        createStep({
          id: 'first',
          inputSchema: z.object({}),
          outputSchema: z.object({}),
          execute: async () => {
            await hooks.firstStep?.();
            return {};
          },
        }),
      )
      .then(
        createStep({
          id: 'later',
          inputSchema: z.object({}),
          outputSchema: z.object({}),
          execute: async () => {
            hooks.laterStep?.();
            return {};
          },
        }),
      )
      .commit();

  it('does not run later steps or overwrite the stored canceled status', async () => {
    const storage = new MockStore();

    let releaseFirstStep!: () => void;
    let firstStepStarted!: () => void;
    const firstStepStartedPromise = new Promise<void>(resolve => (firstStepStarted = resolve));
    let laterStepExecuted = false;

    const owner = new Mastra({
      workflows: {
        [workflowId]: buildWorkflow({
          firstStep: () =>
            new Promise<void>(resolve => {
              releaseFirstStep = resolve;
              firstStepStarted();
            }),
          laterStep: () => {
            laterStepExecuted = true;
          },
        }),
      },
      storage,
      logger: false,
    });
    const other = new Mastra({ workflows: { [workflowId]: buildWorkflow({}) }, storage, logger: false });

    const run = await owner.getWorkflow(workflowId).createRun();
    const resultPromise = run.start({ inputData: {} });
    await firstStepStartedPromise;

    const remoteRun = await other.getWorkflow(workflowId).createRun({ runId: run.runId });
    await remoteRun.cancel();

    const workflowsStore = await storage.getStore('workflows');
    const afterCancel = await workflowsStore?.loadWorkflowSnapshot({ workflowName: workflowId, runId: run.runId });
    expect(afterCancel?.status).toBe('canceled');

    releaseFirstStep();
    const result = await resultPromise;

    expect(laterStepExecuted).toBe(false);
    expect(result.status).toBe('canceled');
    const persisted = await workflowsStore?.loadWorkflowSnapshot({ workflowName: workflowId, runId: run.runId });
    expect(persisted?.status).toBe('canceled');
  });
});

// A fresh start() owns its runId: a `canceled` snapshot left by an earlier attempt with the same
// runId is that attempt's outcome, not a cancellation of the new run.
describe('start() on a runId whose previous attempt was canceled', () => {
  const workflowId = 'reuse-canceled-run-id';

  const buildWorkflow = (execute: () => Promise<object>) =>
    createWorkflow({
      id: workflowId,
      inputSchema: z.object({}),
      outputSchema: z.object({}),
      options: { validateInputs: false },
    })
      .then(createStep({ id: 'step', inputSchema: z.object({}), outputSchema: z.object({}), execute }))
      .commit();

  it.each([
    ['guarded writes', 'the same instance', true, false],
    ['guarded writes', 'another instance', true, true],
    ['read-before-write', 'the same instance', false, false],
    ['read-before-write', 'another instance', false, true],
  ])('runs the new attempt (%s, restarted from %s)', async (_mode, _where, guarded, fromOtherInstance) => {
    const spy = guarded
      ? undefined
      : vi.spyOn(WorkflowsInMemory.prototype, 'supportsGuardedSnapshotWrites').mockReturnValue(false);
    try {
      const storage = new MockStore();
      const runId = 'reused-run-id';
      let firstAttempt = true;
      let markStarted = () => {};
      const started = new Promise<void>(resolve => (markStarted = resolve));
      const execute = vi.fn(async () => {
        if (firstAttempt) {
          firstAttempt = false;
          markStarted();
          await new Promise(resolve => setTimeout(resolve, 20));
        }
        return {};
      });
      const owner = new Mastra({ workflows: { [workflowId]: buildWorkflow(execute) }, storage, logger: false });

      const canceledRun = await owner.getWorkflow(workflowId).createRun({ runId });
      const canceledResult = canceledRun.start({ inputData: {} });
      await started;
      await canceledRun.cancel();
      expect((await canceledResult).status).toBe('canceled');

      const workflowsStore = await storage.getStore('workflows');
      const canceledSnapshot = await workflowsStore?.loadWorkflowSnapshot({ workflowName: workflowId, runId });
      expect(canceledSnapshot?.status).toBe('canceled');

      const restarter = fromOtherInstance
        ? new Mastra({ workflows: { [workflowId]: buildWorkflow(execute) }, storage, logger: false })
        : owner;
      const freshRun = await restarter.getWorkflow(workflowId).createRun({ runId });
      const result = await freshRun.start({ inputData: {} });

      expect(result.status).toBe('success');
      expect(execute).toHaveBeenCalledTimes(2);
      const persisted = await workflowsStore?.loadWorkflowSnapshot({ workflowName: workflowId, runId });
      expect(persisted?.status).toBe('success');
    } finally {
      spy?.mockRestore();
    }
  });

  it('still honors a remote cancellation of the new attempt', async () => {
    const storage = new MockStore();
    const runId = 'reused-run-id-remote-cancel';
    let markStarted = () => {};
    let started = new Promise<void>(resolve => (markStarted = resolve));
    const execute = vi.fn(async () => {
      markStarted();
      await new Promise(resolve => setTimeout(resolve, 20));
      return {};
    });
    const owner = new Mastra({ workflows: { [workflowId]: buildWorkflow(execute) }, storage, logger: false });
    const other = new Mastra({ workflows: { [workflowId]: buildWorkflow(execute) }, storage, logger: false });

    const canceledRun = await owner.getWorkflow(workflowId).createRun({ runId });
    const canceledResult = canceledRun.start({ inputData: {} });
    await started;
    await canceledRun.cancel();
    expect((await canceledResult).status).toBe('canceled');

    started = new Promise<void>(resolve => (markStarted = resolve));
    const freshRun = await owner.getWorkflow(workflowId).createRun({ runId });
    const freshResult = freshRun.start({ inputData: {} });
    await Promise.race([started, freshResult]);
    expect(execute).toHaveBeenCalledTimes(2);
    await (await other.getWorkflow(workflowId).createRun({ runId })).cancel();

    expect((await freshResult).status).toBe('canceled');
    const workflowsStore = await storage.getStore('workflows');
    const persisted = await workflowsStore?.loadWorkflowSnapshot({ workflowName: workflowId, runId });
    expect(persisted?.status).toBe('canceled');
  });
});
