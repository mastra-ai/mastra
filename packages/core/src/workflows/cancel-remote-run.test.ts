import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { Mastra } from '../mastra';
import { WorkflowsInMemory } from '../storage/domains/workflows/inmemory';
import { MockStore } from '../storage/mock';
import { createWorkflow } from './create';
import type { ShouldPersistSnapshotFn } from './types';
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

// PR #29550: skipping snapshots does not make a user workflow local-only.
function gate() {
  let release!: () => void;
  const promise = new Promise<void>(resolve => {
    release = resolve;
  });
  return { promise, release };
}

const never: ShouldPersistSnapshotFn = () => false;
const always: ShouldPersistSnapshotFn = () => true;
const afterThirdStep: ShouldPersistSnapshotFn = ({ workflowStatus, stepResults }) =>
  workflowStatus === 'running' && stepResults.third?.status === 'success';

describe.each([1, 2] as const)('remote cancellation under snapshot policies (storage v%s)', storageVersion => {
  function build(
    id: string,
    policy: ShouldPersistSnapshotFn,
    hooks: Record<string, () => Promise<void>> = {},
    processor = false,
  ) {
    let workflow = createWorkflow({
      id,
      inputSchema: z.object({}),
      outputSchema: z.object({}),
      type: processor ? 'processor' : undefined,
      options: { storageVersion, shouldPersistSnapshot: policy },
    });
    for (const id of ['first', 'second', 'third', 'fourth']) {
      workflow = workflow.then(
        createStep({
          id,
          inputSchema: z.object({}),
          outputSchema: z.object({}),
          execute: async () => {
            await hooks[id]?.();
            return {};
          },
        }),
      );
    }
    return workflow.commit();
  }

  for (const mode of ['start', 'stream'] as const) {
    it.each([
      { name: 'same policy, another server opts into snapshots for this run', policy: never, remoteOverride: always },
      {
        name: 'user processor workflow named like a private agent workflow',
        policy: never,
        remoteOverride: always,
        processor: true,
      },
      { name: 'rolling deployment, another server has persistence enabled', policy: never, remotePolicy: always },
      { name: 'explicit run ID keeps remote cancellation', policy: never, remoteOverride: always, explicitId: true },
      { name: 'per-run opt-out on an otherwise persistent workflow', policy: always, ownerOverride: never },
      {
        name: 'waiting-only persistence still observes another server',
        policy: ({ workflowStatus }) => workflowStatus === 'waiting',
        remoteAsync: true,
      },
      {
        name: 'a locally saved row keeps remote cancellation',
        policy: ({ workflowStatus, stepResults }) =>
          workflowStatus === 'running' && stepResults.first?.status === 'success',
        blockAtSecond: true,
      },
    ] as Array<{
      name: string;
      policy: ShouldPersistSnapshotFn;
      remotePolicy?: ShouldPersistSnapshotFn;
      remoteOverride?: ShouldPersistSnapshotFn;
      ownerOverride?: ShouldPersistSnapshotFn;
      explicitId?: boolean;
      remoteAsync?: boolean;
      blockAtSecond?: boolean;
      processor?: boolean;
    }>)('does not execute a later side effect after cancellation: $name (' + mode + ')', async testCase => {
      const id = testCase.processor ? 'execution-workflow' : `snapshot-policy-${crypto.randomUUID()}`;
      const storage = new MockStore();
      const started = gate(),
        blocked = gate();
      let laterSideEffects = 0;
      const owner = new Mastra({
        logger: false,
        storage,
        workflows: {
          [id]: build(
            id,
            testCase.policy,
            {
              [testCase.blockAtSecond ? 'second' : 'first']: async () => {
                started.release();
                await blocked.promise;
              },
              [testCase.blockAtSecond ? 'third' : 'second']: async () => {
                laterSideEffects++;
              },
            },
            testCase.processor,
          ),
        },
      });
      const remoteBlock = gate();
      const other = new Mastra({
        logger: false,
        storage,
        workflows: {
          [id]: build(
            id,
            testCase.remotePolicy ?? testCase.policy,
            testCase.remoteAsync
              ? {
                  first: async () => {
                    await remoteBlock.promise;
                  },
                }
              : {},
            testCase.processor,
          ),
        },
      });
      const run = await owner.getWorkflow(id).createRun({
        ...(testCase.explicitId ? { runId: 'explicit-' + id } : {}),
        ...(testCase.ownerOverride ? { shouldPersistSnapshot: testCase.ownerOverride } : {}),
      });
      const output = mode === 'start' ? undefined : run.stream({ inputData: {} });
      const resultPromise = output ? output.result : run.start({ inputData: {} });
      await started.promise;
      const remoteRun = await other.getWorkflow(id).createRun({
        runId: run.runId,
        ...(testCase.remoteOverride ? { shouldPersistSnapshot: testCase.remoteOverride } : {}),
      });
      if (testCase.remoteAsync) await remoteRun.startAsync({ inputData: {} });
      await remoteRun.cancel();
      remoteBlock.release();
      const store = await storage.getStore('workflows');
      const storedAtCancel = await store!.loadWorkflowSnapshot({ workflowName: id, runId: run.runId });
      blocked.release();
      const result = await resultPromise;
      expect(storedAtCancel?.status, 'remote cancel must actually reach storage').toBe('canceled');
      expect(laterSideEffects, 'a canceled job must not perform another side effect').toBe(0);
      expect(result.status).toBe('canceled');
    });
  }

  it('observes cancellation when another execution has reached a step-dependent persistence boundary', async () => {
    // No timers: each execution is paused at a deterministic public step boundary.
    const failures: Array<{ attempt: number; sideEffects: number; status: string }> = [];
    for (let attempt = 0; attempt < 20; attempt++) {
      const id = `snapshot-policy-step-policy-${crypto.randomUUID()}`;
      const storage = new MockStore();
      const ownerStarted = gate(),
        ownerBlocked = gate(),
        remoteStarted = gate(),
        remoteBlocked = gate();
      let sideEffects = 0;
      const owner = new Mastra({
        logger: false,
        storage,
        workflows: {
          [id]: build(id, afterThirdStep, {
            first: async () => {
              ownerStarted.release();
              await ownerBlocked.promise;
            },
            second: async () => {
              sideEffects++;
            },
          }),
        },
      });
      const other = new Mastra({
        logger: false,
        storage,
        workflows: {
          [id]: build(id, afterThirdStep, {
            fourth: async () => {
              remoteStarted.release();
              await remoteBlocked.promise;
            },
          }),
        },
      });
      const run = await owner.getWorkflow(id).createRun();
      const pending = run.start({ inputData: {} });
      await ownerStarted.promise;
      const remoteRun = await other.getWorkflow(id).createRun({ runId: run.runId });
      const remotePending = remoteRun.start({ inputData: {} });
      await remoteStarted.promise;
      await remoteRun.cancel();
      const store = await storage.getStore('workflows');
      const canceled = await store!.loadWorkflowSnapshot({ workflowName: id, runId: run.runId });
      ownerBlocked.release();
      const result = await pending;
      remoteBlocked.release();
      await remotePending;
      expect(canceled?.status).toBe('canceled');
      if (sideEffects !== 0 || result.status !== 'canceled')
        failures.push({ attempt, sideEffects, status: result.status });
    }
    expect(failures, 'canceled job must not execute second step, on any repetition').toEqual([]);
  });

  it.each(['before-start', 'during-first'] as const)(
    'local cancellation still blocks side effects (%s)',
    async when => {
      const id = 'snapshot-policy-local-' + crypto.randomUUID();
      const storage = new MockStore();
      const started = gate(),
        blocked = gate();
      let sideEffects = 0;
      const workflow = build(id, never, {
        first: async () => {
          started.release();
          await blocked.promise;
        },
        second: async () => {
          sideEffects++;
        },
      });
      new Mastra({ logger: false, storage, workflows: { [id]: workflow } });
      const run = await workflow.createRun();
      if (when === 'before-start') await run.cancel();
      const pending = run.start({ inputData: {} });
      if (when === 'during-first') {
        await started.promise;
        await run.cancel();
      }
      blocked.release();
      const result = await pending;
      expect(sideEffects).toBe(0);
      expect(result.status).toBe('canceled');
    },
  );

  it('does not invent a cancellation for a run with no stored row', async () => {
    const id = 'snapshot-policy-no-row-' + crypto.randomUUID();
    const storage = new MockStore();
    const started = gate(),
      blocked = gate();
    let sideEffects = 0;
    const owner = new Mastra({
      logger: false,
      storage,
      workflows: {
        [id]: build(id, never, {
          first: async () => {
            started.release();
            await blocked.promise;
          },
          second: async () => {
            sideEffects++;
          },
        }),
      },
    });
    const other = new Mastra({ logger: false, storage, workflows: { [id]: build(id, never) } });
    const run = await owner.getWorkflow(id).createRun();
    const pending = run.start({ inputData: {} });
    await started.promise;
    await (await other.getWorkflow(id).createRun({ runId: run.runId })).cancel();
    blocked.release();
    const result = await pending;
    expect(result.status).toBe('success');
    expect(sideEffects).toBe(1);
  });
});
