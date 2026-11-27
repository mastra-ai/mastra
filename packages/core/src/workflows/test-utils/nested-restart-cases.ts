/**
 * A parent restarted after a crash at its nested run's first save, shared by the in-memory, LibSQL
 * and Postgres suites. The parent saves its nested step as running before the nested run saves its
 * first snapshot, in two separate writes. A crash or a failed write in between leaves a running
 * parent step with no nested run, and restarting the parent failed it with "This workflow run was
 * not active". Found by the workflow-chaos soak main-nostreams-1h.
 *
 * The cases run on JSON stores too, which drop an `undefined` value, so the falsy-input cases show
 * the same behavior wherever a run is stored.
 */
import { AsyncLocalStorage } from 'node:async_hooks';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { Mastra } from '../../mastra';
import type { MastraStorage } from '../../storage';
import type { WorkflowsStorage } from '../../storage/domains/workflows/base';
import { createWorkflow } from '../create';
import type { WorkflowOptions } from '../types';
import { createStep } from '../workflow';
import type { AnyWorkflow } from '../workflow';

type WriteArgs = { workflowName: string; snapshot?: { status?: string }; header?: { status?: string } };

/** Every store method a v1 or v2 run writes through. */
const WRITE_METHODS = [
  'persistWorkflowSnapshot',
  'updateWorkflowResults',
  'updateWorkflowState',
  'updateWorkflowRunHeader',
  'writeWorkflowRunCheckpoint',
  'appendWorkflowRunEntries',
  'mergeWorkflowRunStepResult',
  'appendWorkflowRunStateDraft',
] as const;

/**
 * Routes every workflow write through `decide` until the returned function restores the store.
 * Writes that go through are copied first: the in-memory store keeps the objects it's given, so
 * later in-memory edits would otherwise show up as stored.
 */
function interceptWrites(store: WorkflowsStorage, decide: (args: WriteArgs) => 'write' | 'hang' | 'fail') {
  const spies = WRITE_METHODS.map(method => {
    const write = (store[method] as (...args: unknown[]) => Promise<unknown>).bind(store);
    return vi.spyOn(store, method).mockImplementation((async (args: WriteArgs, ...rest: unknown[]) => {
      const decision = decide(args);
      if (decision === 'hang') return new Promise(() => {});
      if (decision === 'fail') throw new Error('Connection terminated unexpectedly');
      return write(structuredClone(args), ...rest);
    }) as never);
  });
  return () => spies.forEach(spy => spy.mockRestore());
}

/** Lets another process claim the parent run the crashed one held. Nested runs take no lease. */
async function expireLease(store: WorkflowsStorage, runId: string) {
  if (!(await store.supportsRunFencing())) return;
  await store.claimRunOwnership({ runId, ownerId: 'lapsed', leaseMs: -1, force: true });
}

/** A run as stored, in either storage version. */
async function loadStored(store: WorkflowsStorage, version: 1 | 2, workflowName: string, runId: string) {
  if (version === 1) {
    const snapshot = await store.loadWorkflowSnapshot({ workflowName, runId });
    return snapshot && { ...snapshot, steps: snapshot.context as Record<string, { status: string }> };
  }
  const run = await store.loadWorkflowRun({ workflowName, runId, successfulSteps: 'full' });
  return run && { ...run.header, steps: run.steps };
}

/** Runs the cases on storage v1 and v2, each on a fresh store from `createStorage`. */
export function describeNestedRestartCases({ createStorage }: { createStorage: () => Promise<MastraStorage> }) {
  describe.each([1, 2] as const)('restart when the nested run was never saved (storage v%s)', version => {
    const armState = z.object({ log: z.array(z.string()), a: z.string().optional(), b: z.string().optional() });
    type Built = { workflows: Record<string, AnyWorkflow>; calls: Record<string, number> };
    type Revived = <T>(fn: () => Promise<T>) => Promise<T>;

    const readState = () =>
      createStep({
        id: 'read-state',
        inputSchema: z.any(),
        outputSchema: armState,
        stateSchema: armState,
        execute: async ({ getState }) => getState(),
      });

    const prep = (calls: Record<string, number>) =>
      createStep({
        id: 'prep',
        inputSchema: z.object({ value: z.any() }),
        outputSchema: z.any(),
        execute: async ({ inputData }) => {
          calls.prep = (calls.prep ?? 0) + 1;
          return inputData.value;
        },
      });

    /** `parent`: prep, then `nested` (first, second), then read-state. `first` logs the input it got. */
    function buildSequential(nestedOptions?: Pick<WorkflowOptions, 'shouldPersistSnapshot' | 'onStart'>): Built {
      const calls: Record<string, number> = {};
      const logStep = (id: string) =>
        createStep({
          id,
          inputSchema: z.any(),
          outputSchema: z.any(),
          stateSchema: armState,
          execute: async ({ inputData, getState, setState }) => {
            calls[id] = (calls[id] ?? 0) + 1;
            const state = await getState();
            const entry = id === 'first' ? `first:${JSON.stringify(inputData) ?? 'undefined'}` : id;
            await setState({ ...state, log: [...state.log, entry] });
            return inputData;
          },
        });
      const nested = createWorkflow({
        id: 'nested',
        inputSchema: z.any(),
        outputSchema: z.any(),
        stateSchema: armState,
        options: nestedOptions,
      })
        .then(logStep('first'))
        .then(logStep('second'))
        .commit();
      const parent = createWorkflow({
        id: 'parent',
        inputSchema: z.object({ value: z.any() }),
        outputSchema: armState,
        stateSchema: armState,
        options: { storageVersion: version },
      })
        .then(prep(calls))
        .then(nested)
        .then(readState())
        .commit();
      return { workflows: { parent, nested }, calls };
    }

    /**
     * `parent`: prep, then `nested-a` and `nested-b` in parallel, each setting its own state key.
     * `slowArm` finishes last, so it hands back its state after the other arm did.
     */
    function buildParallel(slowArm?: 'a' | 'b'): Built {
      const calls: Record<string, number> = {};
      const arm = (key: 'a' | 'b') =>
        createWorkflow({ id: `nested-${key}`, inputSchema: z.any(), outputSchema: z.any(), stateSchema: armState })
          .then(
            createStep({
              id: `set-${key}`,
              inputSchema: z.any(),
              outputSchema: z.any(),
              stateSchema: armState,
              execute: async ({ inputData, getState, setState }) => {
                calls[key] = (calls[key] ?? 0) + 1;
                if (key === slowArm) await new Promise(resolve => setTimeout(resolve, 50));
                const state = await getState();
                // Its own key, and an entry in the list both arms append to.
                const entry = `${key}:${JSON.stringify(inputData)}`;
                await setState({ ...state, [key]: entry, log: [...state.log, entry] });
                return inputData;
              },
            }),
          )
          .commit();
      const nestedA = arm('a');
      const nestedB = arm('b');
      const parent = createWorkflow({
        id: 'parent',
        inputSchema: z.object({ value: z.any() }),
        outputSchema: armState,
        stateSchema: armState,
        options: { storageVersion: version },
      })
        .then(prep(calls))
        .parallel([nestedA, nestedB])
        .then(readState())
        .commit();
      return { workflows: { parent, 'nested-a': nestedA, 'nested-b': nestedB }, calls };
    }

    /**
     * Starts `parent` and lets the process die at the first nested write that `lands` rejects: that
     * write and every later write it makes never reach storage, except those `landsAfterCut` picks,
     * for a write already in flight at the cut that still commits. Work that runs inside the returned
     * `revived` (the next process) writes normally. The dead process's lease is expired once `committed`
     * resolves: storage refuses the dead process's writes after that, so a write that still commits has
     * to land first, as it would within the lease's TTL.
     */
    async function crashAtNestedWrite(
      { workflows }: Built,
      value: unknown,
      lands: (args: WriteArgs) => boolean = args => args.workflowName === 'parent',
      landsAfterCut: (args: WriteArgs) => boolean = () => false,
      committed: (store: WorkflowsStorage, runId: string) => Promise<unknown> = async () => {},
    ) {
      const storage = await createStorage();
      const store = (await storage.getStore('workflows'))!;
      // The dead process's work keeps running in this test's process, for example an arm that was
      // still reading when the other arm hit the cut. Async context tells its writes apart from the
      // next process's, so none of them can land after the cut.
      const nextProcess = new AsyncLocalStorage<true>();
      let died = false;
      let markDied!: () => void;
      const dead = new Promise<void>(resolve => (markDied = resolve));
      interceptWrites(store, args => {
        if (nextProcess.getStore()) return 'write';
        if (!died && lands(args)) return 'write';
        if (landsAfterCut(args)) return 'write';
        died = true;
        markDied();
        return 'hang';
      });
      new Mastra({ logger: false, storage, workflows });
      const run = await workflows.parent!.createRun();
      void run.start({ inputData: { value }, initialState: { log: ['parent'] } });
      await dead;
      await committed(store, run.runId);
      await nextProcess.run(true, () => expireLease(store, run.runId));
      const revived: Revived = fn => nextProcess.run(true, fn);
      return { storage, store, runId: run.runId, revived };
    }

    async function expectNestedStepRunningWithoutNestedRun(store: WorkflowsStorage, runId: string) {
      const parent = await loadStored(store, version, 'parent', runId);
      expect(parent?.status).toBe('running');
      expect(parent?.steps.nested?.status).toBe('running');
      expect(parent?.activeStepsPath).toHaveProperty('nested');
      expect(await loadStored(store, version, 'nested', runId)).toBeNull();
    }

    /** Neither arm's changes undo the other's. The arms run concurrently, so the list's order varies. */
    function expectBothArms(result: { status: string; result?: unknown }) {
      expect(result.status).toBe('success');
      const state = result.result as z.infer<typeof armState>;
      expect({ ...state, log: [...state.log].sort() }).toEqual({
        log: ['a:{"n":1}', 'b:{"n":1}', 'parent'],
        a: 'a:{"n":1}',
        b: 'b:{"n":1}',
      });
    }

    function restart(built: Built, storage: MastraStorage, runId: string, revived: Revived = fn => fn()) {
      return revived(async () => {
        new Mastra({ logger: false, storage, workflows: built.workflows });
        return (await built.workflows.parent!.createRun({ runId })).restart();
      });
    }

    it.each([[{ n: 1 }], [null], [0], [false], [''], [undefined]])(
      'runs the nested workflow once with its input %j',
      async value => {
        const { storage, store, runId, revived } = await crashAtNestedWrite(buildSequential(), value);
        await expectNestedStepRunningWithoutNestedRun(store, runId);

        const built = buildSequential();
        const result = await restart(built, storage, runId, revived);

        expect(result.status).toBe('success');
        expect(result.status === 'success' && result.result).toEqual({
          log: ['parent', `first:${JSON.stringify(value) ?? 'undefined'}`, 'second'],
        });
        expect(built.calls).toEqual({ first: 1, second: 1 });
        expect((await loadStored(store, version, 'nested', runId))?.status).toBe('success');
      },
    );

    it("runs the nested workflow's onStart once when the nested run was never saved", async () => {
      let onStartCalls = 0;
      const options: Pick<WorkflowOptions, 'onStart'> = { onStart: () => void onStartCalls++ };
      const { storage, store, runId, revived } = await crashAtNestedWrite(buildSequential(options), { n: 1 });
      await expectNestedStepRunningWithoutNestedRun(store, runId);
      expect(onStartCalls).toBe(0);

      const built = buildSequential(options);
      const result = await restart(built, storage, runId, revived);

      expect(result.status).toBe('success');
      expect(result.status === 'success' && result.result).toEqual({ log: ['parent', 'first:{"n":1}', 'second'] });
      expect(onStartCalls).toBe(1);
      expect(built.calls).toEqual({ first: 1, second: 1 });
    });

    /**
     * The nested run saved its pending snapshot and its onStart accepted it, then the process died
     * before the nested run's first step. The restart restarts a saved pending run without calling
     * onStart, as main does, so the returned counter shows whether onStart ran again.
     */
    async function crashAfterNestedOnStart(value: unknown) {
      const onStart = { calls: 0 };
      const options: Pick<WorkflowOptions, 'onStart'> = {
        onStart: () => {
          // A gate such as a quota check, which rejects the run a second time.
          if (++onStart.calls > 1) throw new Error('quota exceeded');
        },
      };
      const { storage, store, runId, revived } = await crashAtNestedWrite(
        buildSequential(options),
        value,
        args => args.workflowName === 'parent' || (args.snapshot ?? args.header)?.status === 'pending',
      );
      expect((await loadStored(store, version, 'nested', runId))?.status).toBe('pending');
      expect(onStart.calls).toBe(1);
      const built = buildSequential(options);
      return { result: await restart(built, storage, runId, revived), built, onStart };
    }

    it('does not call onStart again for a nested run it already accepted', async () => {
      const { result, built, onStart } = await crashAfterNestedOnStart({ n: 1 });

      expect(result.status).toBe('success');
      expect(result.status === 'success' && result.result).toEqual({ log: ['parent', 'first:{"n":1}', 'second'] });
      expect(onStart.calls).toBe(1);
      expect(built.calls).toEqual({ first: 1, second: 1 });
    });

    // A saved pending nested run is recognized by the input it saved, and is restarted without
    // calling onStart, which may never have run. Main saves only a truthy input, so with a falsy
    // one recovery fails and nothing runs without the gate. Recognizing these records too would
    // let them run with their onStart never called; that waits for onStart to run on recovery.
    it.each([[null], [0], [false], [''], [undefined]])(
      'fails recovery of a saved pending nested run with input %j without running it, as main does',
      async value => {
        const { result, built, onStart } = await crashAfterNestedOnStart(value);

        expect(result.status).toBe('failed');
        const { error } = result as { error?: { message?: string } };
        expect(String(error?.message ?? error)).toContain('This workflow run was not active');
        expect(onStart.calls).toBe(1);
        expect(built.calls).toEqual({});
      },
    );

    it('runs a nested workflow that does not save pending snapshots', async () => {
      const options: Pick<WorkflowOptions, 'shouldPersistSnapshot'> = {
        shouldPersistSnapshot: ({ workflowStatus }) => workflowStatus !== 'pending',
      };
      const { storage, store, runId, revived } = await crashAtNestedWrite(buildSequential(options), { n: 1 });
      await expectNestedStepRunningWithoutNestedRun(store, runId);

      const built = buildSequential(options);
      const result = await restart(built, storage, runId, revived);

      expect(result.status).toBe('success');
      expect(result.status === 'success' && result.result).toEqual({ log: ['parent', 'first:{"n":1}', 'second'] });
      expect(built.calls).toEqual({ first: 1, second: 1 });
    });

    it('recovers the run on boot', async () => {
      const { storage, store, runId, revived } = await crashAtNestedWrite(buildSequential(), { n: 1 });

      const built = buildSequential();
      // The crash was just now; a zero grace lets recovery restart the run at once.
      await revived(() =>
        new Mastra({
          logger: false,
          storage,
          workflows: built.workflows,
          recovery: { workflowGraceMs: 0 },
        }).restartAllActiveWorkflowRuns(),
      );

      const parent = await loadStored(store, version, 'parent', runId);
      expect(parent?.status).toBe('success');
      expect(parent?.result).toEqual({ log: ['parent', 'first:{"n":1}', 'second'] });
      expect(built.calls).toEqual({ first: 1, second: 1 });
    });

    it('runs the nested workflow when its first write failed and the worker kept running', async () => {
      const storage = await createStorage();
      const store = (await storage.getStore('workflows'))!;
      // The database drops out at the nested run's first write, so that write and the parent's
      // writes that follow it fail. The process itself keeps running.
      let outage = false;
      const restore = interceptWrites(store, args => {
        if (args.workflowName !== 'parent') outage = true;
        return outage ? 'fail' : 'write';
      });
      const first = buildSequential();
      new Mastra({ logger: false, storage, workflows: first.workflows });
      const run = await first.workflows.parent!.createRun();
      await run.start({ inputData: { value: { n: 1 } }, initialState: { log: ['parent'] } }).catch(() => {});
      expect(outage).toBe(true);
      expect(first.calls).toEqual({ prep: 1 });
      restore();
      await expireLease(store, run.runId);
      await expectNestedStepRunningWithoutNestedRun(store, run.runId);

      const built = buildSequential();
      const result = await restart(built, storage, run.runId);

      expect(result.status).toBe('success');
      expect(result.status === 'success' && result.result).toEqual({ log: ['parent', 'first:{"n":1}', 'second'] });
      expect(built.calls).toEqual({ first: 1, second: 1 });
    });

    it.each(['a', 'b'] as const)(
      'keeps the state of both parallel arms when one nested run was saved and the other was not (arm %s last)',
      async slowArm => {
        // As in the soak's parallel trace: nested-a saved its pending snapshot, nested-b never did.
        // nested-a is restarted and nested-b is started; each order of their hand-backs must keep both.
        // The arms reach storage in either order, so nested-a's insert lands even after the cut.
        const savesA = (args: WriteArgs) =>
          args.workflowName === 'nested-a' && (args.snapshot ?? args.header)?.status === 'pending';
        const { storage, store, runId, revived } = await crashAtNestedWrite(
          buildParallel(),
          { n: 1 },
          args => args.workflowName === 'parent' || savesA(args),
          savesA,
          (store, runId) =>
            vi.waitFor(async () =>
              expect((await loadStored(store, version, 'nested-a', runId))?.status).toBe('pending'),
            ),
        );
        expect(await loadStored(store, version, 'nested-b', runId)).toBeNull();

        const built = buildParallel(slowArm);
        const result = await restart(built, storage, runId, revived);

        expectBothArms(result);
        expect(built.calls).toEqual({ a: 1, b: 1 });
      },
    );

    it('keeps the state of both parallel arms when neither nested run was saved', async () => {
      const { storage, store, runId, revived } = await crashAtNestedWrite(buildParallel(), { n: 1 });
      expect(await loadStored(store, version, 'nested-a', runId)).toBeNull();
      expect(await loadStored(store, version, 'nested-b', runId)).toBeNull();

      const built = buildParallel('a');
      const result = await restart(built, storage, runId, revived);

      expectBothArms(result);
      expect(built.calls).toEqual({ a: 1, b: 1 });
    });
  });
}
