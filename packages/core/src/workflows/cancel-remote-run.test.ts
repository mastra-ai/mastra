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
describe.each([1, 2] as const)(
  'cancel() from another Mastra instance sharing storage (storage v%s)',
  storageVersion => {
    const workflowId = 'cancel-remote-run';

    const buildWorkflow = (hooks: { firstStep?: () => Promise<void>; laterStep?: () => void }) =>
      createWorkflow({
        id: workflowId,
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        options: { validateInputs: false, storageVersion },
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
  },
);

// A fresh start() owns its runId: a `canceled` snapshot left by an earlier attempt with the same
// runId is that attempt's outcome, not a cancellation of the new run.
describe.each([1, 2] as const)(
  'start() on a runId whose previous attempt was canceled (storage v%s)',
  storageVersion => {
    const workflowId = 'reuse-canceled-run-id';

    const buildWorkflow = (execute: () => Promise<object>) =>
      createWorkflow({
        id: workflowId,
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        options: { validateInputs: false, storageVersion },
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
  },
);

// Agents' per-call stream-preparation and processor workflows set `localCancellationOnly`, so
// they skip stored-cancellation reads. A user workflow keeps them whatever its snapshot policy,
// type or id, because another server can still store and cancel the same run.
describe.each([1, 2] as const)('cancellation of runs that store no snapshot (storage v%s)', storageVersion => {
  const neverPersist = () => false;

  function build(
    id: string,
    hooks: { first?: () => Promise<void>; second?: () => void } = {},
    extra: { type?: 'processor'; localCancellationOnly?: boolean } = {},
  ) {
    return createWorkflow({
      id,
      inputSchema: z.object({}),
      outputSchema: z.object({}),
      type: extra.type,
      options: {
        storageVersion,
        shouldPersistSnapshot: neverPersist,
        localCancellationOnly: extra.localCancellationOnly,
      },
    })
      .then(
        createStep({
          id: 'first',
          inputSchema: z.object({}),
          outputSchema: z.object({}),
          execute: async () => {
            await hooks.first?.();
            return {};
          },
        }),
      )
      .then(
        createStep({
          id: 'second',
          inputSchema: z.object({}),
          outputSchema: z.object({}),
          execute: async () => {
            hooks.second?.();
            return {};
          },
        }),
      )
      .commit();
  }

  function gate() {
    let release!: () => void;
    const promise = new Promise<void>(resolve => (release = resolve));
    return { promise, release };
  }

  it.each([
    { name: 'a user workflow', id: 'user-transient-workflow' },
    // Same id and type as an agent's internal workflow: only the option opts out, not the name.
    { name: 'a user processor workflow with an internal-looking id', id: 'execution-workflow', type: 'processor' },
  ] as const)('$name stops when another server stores and cancels its run', async ({ id, ...extra }) => {
    const storage = new MockStore();
    const started = gate();
    const blocked = gate();
    let secondRan = false;
    const owner = new Mastra({
      logger: false,
      storage,
      workflows: {
        [id]: build(
          id,
          {
            first: async () => {
              started.release();
              await blocked.promise;
            },
            second: () => {
              secondRan = true;
            },
          },
          extra,
        ),
      },
    });
    const other = new Mastra({ logger: false, storage, workflows: { [id]: build(id, {}, extra) } });

    const run = await owner.getWorkflow(id).createRun();
    const pending = run.start({ inputData: {} });
    await started.promise;
    // The other server stores this run (its own policy for the run) and cancels it there.
    const remoteRun = await other.getWorkflow(id).createRun({ runId: run.runId, shouldPersistSnapshot: () => true });
    await remoteRun.cancel();
    const store = await storage.getStore('workflows');
    expect((await store!.loadWorkflowSnapshot({ workflowName: id, runId: run.runId }))?.status).toBe('canceled');
    blocked.release();

    expect((await pending).status).toBe('canceled');
    expect(secondRan).toBe(false);
  });

  it.each(['before start', 'during the first step'] as const)(
    'a local-only workflow still stops on run.cancel() %s, without reading storage',
    async when => {
      const id = 'local-only-workflow';
      const storage = new MockStore();
      const started = gate();
      const blocked = gate();
      let secondRan = false;
      const workflow = build(
        id,
        {
          first: async () => {
            started.release();
            await blocked.promise;
          },
          second: () => {
            secondRan = true;
          },
        },
        { localCancellationOnly: true },
      );
      new Mastra({ logger: false, storage, workflows: { [id]: workflow } });
      const store = await storage.getStore('workflows');
      const statusReads = vi.spyOn(store!, 'loadWorkflowRunStatus');

      const run = await workflow.createRun();
      if (when === 'before start') await run.cancel();
      const pending = run.start({ inputData: {} });
      if (when === 'during the first step') {
        await started.promise;
        await run.cancel();
      }
      blocked.release();

      expect((await pending).status).toBe('canceled');
      expect(secondRan).toBe(false);
      expect(statusReads).not.toHaveBeenCalled();
    },
  );
});
