import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { Mastra } from '../mastra';
import { WorkflowsInMemory } from '../storage/domains/workflows/inmemory';
import { MockStore } from '../storage/mock';
import { createWorkflow } from './create';
import { createStep } from './workflow';

// Regression coverage for https://github.com/mastra-ai/mastra/issues/17908
describe('workflow sleep cancellation', () => {
  const noopStep = (id: string, execute = vi.fn().mockResolvedValue({})) =>
    createStep({
      id,
      inputSchema: z.object({}),
      outputSchema: z.object({}),
      execute,
    });

  // Stores without guarded snapshot writes (MongoDB, DynamoDB, Redis, ...) read the stored status
  // before each write instead. The in-memory store is guarded, so switch it to that path.
  async function withReadBeforeWrite<T>(guarded: boolean, run: () => Promise<T>): Promise<T> {
    if (guarded) return run();
    const spy = vi.spyOn(WorkflowsInMemory.prototype, 'supportsGuardedSnapshotWrites').mockReturnValue(false);
    try {
      return await run();
    } finally {
      spy.mockRestore();
    }
  }

  async function waitForWaitingStatus(storage: MockStore, workflowName: string, runId: string) {
    const store = await storage.getStore('workflows');

    await vi.waitFor(async () => {
      const snapshot = await store?.loadWorkflowSnapshot({ workflowName, runId });
      expect(snapshot?.status).toBe('waiting');
    });

    return store;
  }

  it.each([
    ['sleep', (workflow: ReturnType<typeof createWorkflow>) => workflow.sleep(60_000)],
    ['sleepUntil', (workflow: ReturnType<typeof createWorkflow>) => workflow.sleepUntil(new Date(Date.now() + 60_000))],
  ] as const)('cancel() interrupts %s and preserves the canceled status', async (_, addSleep) => {
    const afterSleep = vi.fn().mockResolvedValue({});
    const workflowId = `cancel-${_}-workflow`;
    const workflow = addSleep(
      createWorkflow({
        id: workflowId,
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        options: { validateInputs: false },
      }).then(noopStep('before-sleep')),
    )
      .then(noopStep('after-sleep', afterSleep))
      .commit();

    const storage = new MockStore();
    new Mastra({ logger: false, storage, workflows: { [workflowId]: workflow } });
    const run = await workflow.createRun();
    const resultPromise = run.start({ inputData: {} });
    const store = await waitForWaitingStatus(storage, workflowId, run.runId);

    await run.cancel();
    const result = await resultPromise;

    expect(result.status).toBe('canceled');
    expect(afterSleep).not.toHaveBeenCalled();

    const snapshot = await store?.loadWorkflowSnapshot({ workflowName: workflowId, runId: run.runId });
    expect(snapshot?.status).toBe('canceled');
  });

  it.each([
    ['guarded writes', true],
    ['read-before-write', false],
  ])('preserves cancellation requested by another workflow instance (%s)', (_, guarded) =>
    withReadBeforeWrite(guarded, async () => {
      const workflowId = 'remote-cancel-workflow';
      const storage = new MockStore();
      const afterBlockedStep = vi.fn().mockResolvedValue({});
      let releaseBlockedStep = () => {};
      let markBlockedStepStarted = () => {};
      const blockedStepStarted = new Promise<void>(resolve => {
        markBlockedStepStarted = resolve;
      });
      const blockedStepReleased = new Promise<void>(resolve => {
        releaseBlockedStep = resolve;
      });
      const buildWorkflow = () =>
        createWorkflow({
          id: workflowId,
          inputSchema: z.object({}),
          outputSchema: z.object({}),
          options: { validateInputs: false },
        })
          .then(
            noopStep('blocked-step', async () => {
              markBlockedStepStarted();
              await blockedStepReleased;
              return {};
            }),
          )
          .then(noopStep('after-blocked-step', afterBlockedStep))
          .commit();

      const activeWorkflow = buildWorkflow();
      const remoteWorkflow = buildWorkflow();
      new Mastra({ logger: false, storage, workflows: { [workflowId]: activeWorkflow } });
      new Mastra({ logger: false, storage, workflows: { [workflowId]: remoteWorkflow } });

      const activeRun = await activeWorkflow.createRun();
      const resultPromise = activeRun.start({ inputData: {} });
      await blockedStepStarted;

      const remoteRun = await remoteWorkflow.createRun({ runId: activeRun.runId });
      await remoteRun.cancel();
      releaseBlockedStep();

      const result = await resultPromise;
      expect(result.status).toBe('canceled');
      expect(afterBlockedStep).not.toHaveBeenCalled();

      const store = await storage.getStore('workflows');
      const snapshot = await store?.loadWorkflowSnapshot({ workflowName: workflowId, runId: activeRun.runId });
      expect(snapshot?.status).toBe('canceled');
    }),
  );

  // Read-before-write stores can't close the window between their status read and the write. This
  // covers what they do promise: a cancellation that commits before the read stops the run.
  it.each([
    ['sequential', false],
    ['perStep', true],
  ])(
    'preserves a remote cancellation that commits just before a stored-status read on read-before-write stores (%s)',
    (_, perStep) =>
      withReadBeforeWrite(false, async () => {
        const workflowId = 'remote-cancel-before-read-workflow';
        const storage = new MockStore();
        const firstStep = vi.fn().mockResolvedValue({});
        const secondStep = vi.fn().mockResolvedValue({});
        const buildWorkflow = () =>
          createWorkflow({
            id: workflowId,
            inputSchema: z.object({}),
            outputSchema: z.object({}),
            options: { validateInputs: false },
          })
            .then(noopStep('first-step', firstStep))
            .then(noopStep('second-step', secondStep))
            .commit();

        const activeWorkflow = buildWorkflow();
        const remoteWorkflow = buildWorkflow();
        new Mastra({ logger: false, storage, workflows: { [workflowId]: activeWorkflow } });
        new Mastra({ logger: false, storage, workflows: { [workflowId]: remoteWorkflow } });

        const activeRun = await activeWorkflow.createRun();
        const store = (await storage.getStore('workflows'))!;
        const loadStatus = store.loadWorkflowRunStatus.bind(store);
        let canceled = false;
        vi.spyOn(store, 'loadWorkflowRunStatus').mockImplementation(async args => {
          if (!canceled && firstStep.mock.calls.length > 0) {
            canceled = true;
            const remoteRun = await remoteWorkflow.createRun({ runId: activeRun.runId });
            await remoteRun.cancel();
          }
          return loadStatus(args);
        });

        const result = await activeRun.start({ inputData: {}, perStep });

        expect(canceled).toBe(true);
        expect(result.status).toBe('canceled');
        expect(secondStep).not.toHaveBeenCalled();
        const snapshot = await store.loadWorkflowSnapshot({ workflowName: workflowId, runId: activeRun.runId });
        expect(snapshot?.status).toBe('canceled');
      }),
  );

  // Guarded stores refuse the write itself, so the cancel lands right before the target write.
  // Read-before-write stores can only honor a cancel that commits before their status read, so
  // there it lands right after the write that precedes the target write.
  function cancelRemotelyBefore(
    store: Awaited<ReturnType<MockStore['getStore']>> & {},
    {
      guarded,
      status,
      armed,
      cancel,
    }: { guarded: boolean; status: string; armed: () => boolean; cancel: () => Promise<void> },
  ) {
    const persist = store.persistWorkflowSnapshot.bind(store);
    const state = { canceled: false };
    vi.spyOn(store, 'persistWorkflowSnapshot').mockImplementation(async args => {
      if (guarded && !state.canceled && args.snapshot.status === status) {
        state.canceled = true;
        await cancel();
        return persist(args);
      }
      const written = await persist(args);
      if (!guarded && !state.canceled && armed() && args.snapshot.status === 'running') {
        state.canceled = true;
        await cancel();
      }
      return written;
    });
    return state;
  }

  const storeModes = [
    ['guarded', true],
    ['read-before-write', false],
  ] as const;

  it.each(storeModes)(
    'preserves a remote cancellation that commits just before the final snapshot write (%s)',
    (_, guarded) =>
      withReadBeforeWrite(guarded, async () => {
        const workflowId = 'remote-cancel-before-write-workflow';
        const storage = new MockStore();
        const onlyStep = vi.fn().mockResolvedValue({});
        const buildWorkflow = () =>
          createWorkflow({
            id: workflowId,
            inputSchema: z.object({}),
            outputSchema: z.object({}),
            options: { validateInputs: false },
          })
            .then(noopStep('only-step', onlyStep))
            .commit();

        const activeWorkflow = buildWorkflow();
        const remoteWorkflow = buildWorkflow();
        new Mastra({ logger: false, storage, workflows: { [workflowId]: activeWorkflow } });
        new Mastra({ logger: false, storage, workflows: { [workflowId]: remoteWorkflow } });

        const activeRun = await activeWorkflow.createRun();
        const store = (await storage.getStore('workflows'))!;
        const race = cancelRemotelyBefore(store, {
          guarded,
          status: 'success',
          armed: () => onlyStep.mock.calls.length > 0,
          cancel: async () => (await remoteWorkflow.createRun({ runId: activeRun.runId })).cancel(),
        });

        const result = await activeRun.start({ inputData: {} });

        expect(race.canceled).toBe(true);
        const snapshot = await store.loadWorkflowSnapshot({ workflowName: workflowId, runId: activeRun.runId });
        expect(snapshot?.status).toBe('canceled');
        expect(result.status).toBe('canceled');
      }),
  );

  it.each(storeModes)(
    'preserves a remote cancellation that commits just before a per-step pause write (%s)',
    (_, guarded) =>
      withReadBeforeWrite(guarded, async () => {
        const workflowId = 'remote-cancel-before-pause-workflow';
        const storage = new MockStore();
        const firstStep = vi.fn().mockResolvedValue({});
        const buildWorkflow = () =>
          createWorkflow({
            id: workflowId,
            inputSchema: z.object({}),
            outputSchema: z.object({}),
            options: { validateInputs: false },
          })
            .then(noopStep('first-step', firstStep))
            .then(noopStep('second-step'))
            .commit();

        const activeWorkflow = buildWorkflow();
        const remoteWorkflow = buildWorkflow();
        new Mastra({ logger: false, storage, workflows: { [workflowId]: activeWorkflow } });
        new Mastra({ logger: false, storage, workflows: { [workflowId]: remoteWorkflow } });

        const activeRun = await activeWorkflow.createRun();
        const store = (await storage.getStore('workflows'))!;
        const race = cancelRemotelyBefore(store, {
          guarded,
          status: 'paused',
          armed: () => firstStep.mock.calls.length > 0,
          cancel: async () => (await remoteWorkflow.createRun({ runId: activeRun.runId })).cancel(),
        });

        const result = await activeRun.start({ inputData: {}, perStep: true });

        expect(race.canceled).toBe(true);
        const snapshot = await store.loadWorkflowSnapshot({ workflowName: workflowId, runId: activeRun.runId });
        expect(snapshot?.status).toBe('canceled');
        expect(result.status).toBe('canceled');
      }),
  );

  it.each(storeModes)(
    'preserves a remote cancellation that commits just before an executor-abort waiting write (%s)',
    (_, guarded) =>
      withReadBeforeWrite(guarded, async () => {
        const workflowId = 'remote-cancel-before-waiting-workflow';
        const storage = new MockStore();
        const firstStep = vi.fn().mockResolvedValue({});
        const secondStep = vi.fn().mockResolvedValue({});
        const buildWorkflow = () =>
          createWorkflow({
            id: workflowId,
            inputSchema: z.object({}),
            outputSchema: z.object({}),
            options: { validateInputs: false },
          })
            .then(noopStep('first-step', firstStep))
            .then(noopStep('second-step', secondStep))
            .commit();

        const activeWorkflow = buildWorkflow();
        const remoteWorkflow = buildWorkflow();
        new Mastra({ logger: false, storage, workflows: { [workflowId]: activeWorkflow } });
        new Mastra({ logger: false, storage, workflows: { [workflowId]: remoteWorkflow } });

        const activeRun = await activeWorkflow.createRun();
        const runId = activeRun.runId;
        const store = (await storage.getStore('workflows'))!;
        // Abort the executor after the first step has finished, so the loop-top abort branch
        // writes `waiting` instead of the step handler.
        const loadStatus = store.loadWorkflowRunStatus.bind(store);
        vi.spyOn(store, 'loadWorkflowRunStatus').mockImplementation(async args => {
          if (firstStep.mock.calls.length > 0) activeRun.abortController.abort();
          return loadStatus(args);
        });
        const race = cancelRemotelyBefore(store, {
          guarded,
          status: 'waiting',
          armed: () => firstStep.mock.calls.length > 0,
          cancel: async () => (await remoteWorkflow.createRun({ runId })).cancel(),
        });

        const result = await activeRun.start({ inputData: {} });

        expect(race.canceled).toBe(true);
        const snapshot = await store.loadWorkflowSnapshot({ workflowName: workflowId, runId });
        expect(snapshot?.status).toBe('canceled');
        expect(result.status).toBe('canceled');
        expect(secondStep).not.toHaveBeenCalled();
      }),
  );

  it.each([
    ['cannot be claimed', ({ workflowStatus }: { workflowStatus: string }) => workflowStatus !== 'running'],
    ['is claimed', () => true],
  ] as const)('time travels a canceled run whose restart %s', async (_, shouldPersistSnapshot) => {
    const workflowId = `time-travel-canceled-workflow-${_.replace(' ', '-')}`;
    const storage = new MockStore();
    const afterBlockedStep = vi.fn().mockResolvedValue({});
    let releaseBlockedStep = () => {};
    let markBlockedStepStarted = () => {};
    const blockedStepStarted = new Promise<void>(resolve => {
      markBlockedStepStarted = resolve;
    });
    const blockedStepReleased = new Promise<void>(resolve => {
      releaseBlockedStep = resolve;
    });
    const workflow = createWorkflow({
      id: workflowId,
      inputSchema: z.object({}),
      outputSchema: z.object({}),
      // Without `running` snapshots time travel cannot claim the run, so its stored
      // status stays `canceled` while the engine replays it.
      options: { validateInputs: false, shouldPersistSnapshot },
    })
      .then(
        noopStep('blocked-step', async () => {
          markBlockedStepStarted();
          await blockedStepReleased;
          return {};
        }),
      )
      .then(noopStep('after-blocked-step', afterBlockedStep))
      .commit();
    new Mastra({ logger: false, storage, workflows: { [workflowId]: workflow } });

    const run = await workflow.createRun();
    const resultPromise = run.start({ inputData: {} });
    await blockedStepStarted;
    await run.cancel();
    releaseBlockedStep();
    expect((await resultPromise).status).toBe('canceled');

    const replay = await workflow.createRun({ runId: run.runId });
    const result = await replay.timeTravel({ step: 'after-blocked-step', inputData: {} });

    expect(result.status).toBe('success');
    expect(afterBlockedStep).toHaveBeenCalledOnce();
    const store = await storage.getStore('workflows');
    const snapshot = await store?.loadWorkflowSnapshot({ workflowName: workflowId, runId: run.runId });
    expect(snapshot?.status).toBe('success');
  });

  it('honors a remote cancellation once a time-travel replay of a canceled run has written its own status', async () => {
    const workflowId = 'time-travel-canceled-then-remote-cancel-workflow';
    const storage = new MockStore();
    const lastStep = vi.fn().mockResolvedValue({});
    const gates = { first: Promise.withResolvers<void>(), middle: Promise.withResolvers<void>() };
    const started = { first: Promise.withResolvers<void>(), middle: Promise.withResolvers<void>() };
    const buildWorkflow = () =>
      createWorkflow({
        id: workflowId,
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        options: { validateInputs: false },
      })
        .then(
          noopStep('first-step', async () => {
            started.first.resolve();
            await gates.first.promise;
            return {};
          }),
        )
        .then(
          noopStep('middle-step', async () => {
            started.middle.resolve();
            await gates.middle.promise;
            return {};
          }),
        )
        .then(noopStep('last-step', lastStep))
        .commit();

    const activeWorkflow = buildWorkflow();
    const remoteWorkflow = buildWorkflow();
    new Mastra({ logger: false, storage, workflows: { [workflowId]: activeWorkflow } });
    new Mastra({ logger: false, storage, workflows: { [workflowId]: remoteWorkflow } });

    const run = await activeWorkflow.createRun();
    const firstResult = run.start({ inputData: {} });
    await started.first.promise;
    await run.cancel();
    gates.first.resolve();
    expect((await firstResult).status).toBe('canceled');

    // A store without concurrent updates cannot claim the replay, so it starts from `canceled`.
    const store = (await storage.getStore('workflows'))!;
    vi.spyOn(store, 'supportsConcurrentUpdates').mockReturnValue(false);
    const replay = await activeWorkflow.createRun({ runId: run.runId });
    const replayResult = replay.timeTravel({ step: 'middle-step', inputData: {} });
    await started.middle.promise;
    const remoteRun = await remoteWorkflow.createRun({ runId: run.runId });
    await remoteRun.cancel();
    gates.middle.resolve();

    expect((await replayResult).status).toBe('canceled');
    expect(lastStep).not.toHaveBeenCalled();
    const snapshot = await store.loadWorkflowSnapshot({ workflowName: workflowId, runId: run.runId });
    expect(snapshot?.status).toBe('canceled');
  });

  it('time travels a run whose cancellation was recorded by the abort branch', async () => {
    const workflowId = 'time-travel-abort-branch-canceled-workflow';
    const storage = new MockStore();
    const afterFirstStep = vi.fn().mockResolvedValue({});
    const workflow = createWorkflow({
      id: workflowId,
      inputSchema: z.object({}),
      outputSchema: z.object({}),
      options: {
        validateInputs: false,
        shouldPersistSnapshot: ({ workflowStatus }) => workflowStatus === 'canceled',
      },
    })
      .then(noopStep('first-step', async () => ({})))
      .then(noopStep('after-first-step', afterFirstStep))
      .commit();
    new Mastra({ logger: false, storage, workflows: { [workflowId]: workflow } });

    const store = await storage.getStore('workflows');
    if (!store) throw new Error('workflows store missing');
    const run = await workflow.createRun();
    const loadStatus = store.loadWorkflowRunStatus.bind(store);
    // Cancel after the first step's result is decided but before the engine's
    // abort check. cancel()'s own storage write fails (and is swallowed), so the
    // engine's abort branch is what records the cancellation.
    const statusRead = vi.spyOn(store, 'loadWorkflowRunStatus').mockImplementationOnce(async args => {
      const status = await loadStatus(args);
      vi.spyOn(store, 'updateWorkflowState').mockRejectedValueOnce(new Error('unavailable'));
      await run.cancel();
      return status;
    });

    expect((await run.start({ inputData: {} })).status).toBe('canceled');
    expect(afterFirstStep).not.toHaveBeenCalled();
    expect((await store.loadWorkflowSnapshot({ workflowName: workflowId, runId: run.runId }))?.status).toBe('canceled');
    statusRead.mockRestore();
    vi.restoreAllMocks();

    const replay = await workflow.createRun({ runId: run.runId });
    const result = await replay.timeTravel({ step: 'after-first-step', inputData: {} });

    expect(result.status).toBe('success');
    expect(afterFirstStep).toHaveBeenCalledTimes(1);
  });

  const loopShapes = [
    [
      'dountil',
      (workflow: ReturnType<typeof createWorkflow>, body: ReturnType<typeof noopStep>) =>
        workflow.dountil(body, async ({ iterationCount }) => iterationCount >= 3),
      {},
    ],
    [
      'foreach',
      (workflow: ReturnType<typeof createWorkflow>, body: ReturnType<typeof noopStep>) =>
        workflow.foreach(body, { concurrency: 1 }),
      [{}, {}, {}],
    ],
  ] as const;

  it.each(
    loopShapes.flatMap(([shape, addLoop, inputData]) =>
      [true, false].map(
        guarded => [shape, guarded ? 'guarded' : 'read-before-write', addLoop, inputData, guarded] as const,
      ),
    ),
  )('stops a %s loop after a remote cancellation (%s store)', async (shape, mode, addLoop, inputData, guarded) => {
    await withReadBeforeWrite(guarded, async () => {
      const workflowId = `remote-cancel-${shape}-${mode}-workflow`;
      const storage = new MockStore();
      const afterLoop = vi.fn().mockResolvedValue({});
      let releaseFirstIteration = () => {};
      let markFirstIterationStarted = () => {};
      const firstIterationStarted = new Promise<void>(resolve => {
        markFirstIterationStarted = resolve;
      });
      const firstIterationReleased = new Promise<void>(resolve => {
        releaseFirstIteration = resolve;
      });
      const loopBody = vi.fn(async () => {
        if (loopBody.mock.calls.length === 1) {
          markFirstIterationStarted();
          await firstIterationReleased;
        }
        return {};
      });
      const buildWorkflow = () =>
        addLoop(
          createWorkflow({
            id: workflowId,
            inputSchema: z.any(),
            outputSchema: z.any(),
            options: { validateInputs: false },
          }),
          createStep({ id: 'loop-body', inputSchema: z.any(), outputSchema: z.any(), execute: loopBody }),
        )
          .then(noopStep('after-loop', afterLoop))
          .commit();

      const activeWorkflow = buildWorkflow();
      const remoteWorkflow = buildWorkflow();
      new Mastra({ logger: false, storage, workflows: { [workflowId]: activeWorkflow } });
      new Mastra({ logger: false, storage, workflows: { [workflowId]: remoteWorkflow } });

      const activeRun = await activeWorkflow.createRun();
      const resultPromise = activeRun.start({ inputData });
      await firstIterationStarted;
      await (await remoteWorkflow.createRun({ runId: activeRun.runId })).cancel();
      releaseFirstIteration();
      const result = await resultPromise;

      expect(loopBody).toHaveBeenCalledTimes(1);
      expect(afterLoop).not.toHaveBeenCalled();
      expect(result.status).toBe('canceled');
      const store = await storage.getStore('workflows');
      const snapshot = await store?.loadWorkflowSnapshot({ workflowName: workflowId, runId: activeRun.runId });
      expect(snapshot?.status).toBe('canceled');
    });
  });

  it('completes a sleep normally when the run is not canceled', async () => {
    const afterSleep = vi.fn().mockResolvedValue({});
    const workflow = createWorkflow({
      id: 'normal-sleep-workflow',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
      options: { validateInputs: false },
    })
      .then(noopStep('before-sleep'))
      .sleep(10)
      .then(noopStep('after-sleep', afterSleep))
      .commit();

    new Mastra({ logger: false, workflows: { 'normal-sleep-workflow': workflow } });
    const run = await workflow.createRun();
    const result = await run.start({ inputData: {} });

    expect(result.status).toBe('success');
    expect(afterSleep).toHaveBeenCalledOnce();
  });
});
