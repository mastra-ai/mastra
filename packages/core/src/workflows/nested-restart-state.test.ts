/**
 * restart() on a parent whose nested workflow was mid-run must carry the nested
 * run's workflow state back to the parent, like start() and resume() do.
 */

import { AsyncLocalStorage } from 'node:async_hooks';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { Mastra } from '../mastra';
import { MockStore } from '../storage/mock';
import { createWorkflow } from './create';
import type { WorkflowOptions, WorkflowRunState } from './types';
import { createStep } from './workflow';
import type { AnyWorkflow } from './workflow';

const stateSchema = z.object({ log: z.array(z.string()) });

function build(onSecond: () => Promise<void>) {
  const first = createStep({
    id: 'first',
    inputSchema: z.object({}),
    outputSchema: z.object({}),
    stateSchema,
    execute: async ({ state, setState }) => {
      await setState({ ...state, log: [...state.log, 'first'] });
      return {};
    },
  });
  const second = createStep({
    id: 'second',
    inputSchema: z.object({}),
    outputSchema: z.object({}),
    stateSchema,
    execute: async ({ state, setState }) => {
      await onSecond();
      await setState({ ...state, log: [...state.log, 'second'] });
      return {};
    },
  });
  const nested = createWorkflow({
    id: 'nested',
    inputSchema: z.object({}),
    outputSchema: z.object({}),
    stateSchema,
  })
    .then(first)
    .then(second)
    .commit();
  const readState = createStep({
    id: 'read-state',
    inputSchema: z.object({}),
    outputSchema: z.object({ log: z.array(z.string()) }),
    stateSchema,
    execute: async ({ state }) => ({ log: state.log }),
  });
  const parent = createWorkflow({
    id: 'parent',
    inputSchema: z.object({}),
    outputSchema: z.object({ log: z.array(z.string()) }),
    stateSchema,
  })
    .then(nested)
    .then(readState)
    .commit();
  return { parent, nested };
}

describe('nested workflow restart state', () => {
  it('applies the restarted nested run state to the parent', async () => {
    const storage1 = new MockStore();
    let markRunning!: () => void;
    const running = new Promise<void>(r => (markRunning = r));
    const p1 = build(async () => {
      markRunning();
      await new Promise(() => {}); // process "dies" here
    });
    new Mastra({ logger: false, storage: storage1, workflows: { parent: p1.parent, nested: p1.nested } });

    const run1 = await p1.parent.createRun();
    void run1.start({ inputData: {}, initialState: { log: [] } });
    await running;

    const store1 = (await storage1.getStore('workflows'))!;
    const storage2 = new MockStore();
    const store2 = (await storage2.getStore('workflows'))!;
    for (const name of ['parent', 'nested']) {
      const snapshot = await store1.loadWorkflowSnapshot({ workflowName: name, runId: run1.runId });
      expect(snapshot?.status).toBe('running');
      await store2.persistWorkflowSnapshot({
        workflowName: name,
        runId: run1.runId,
        snapshot: JSON.parse(JSON.stringify(snapshot)),
      });
    }

    const p2 = build(async () => {});
    new Mastra({ logger: false, storage: storage2, workflows: { parent: p2.parent, nested: p2.nested } });

    const result = await (await p2.parent.createRun({ runId: run1.runId })).restart();

    expect(result.status).toBe('success');
    if (result.status === 'success') {
      expect(result.result).toEqual({ log: ['first', 'second'] });
    }
  });

  // A nested run stored as `pending` is restarted from its first step through the pending-with-input
  // branch of createRestartExecutionParams (#16520), so its onStart doesn't run again.
  it('keeps the parent state when the nested run restarts before its first step', async () => {
    const storage1 = new MockStore();
    const store1 = (await storage1.getStore('workflows'))!;
    let pendingNested: unknown;
    const persist = store1.persistWorkflowSnapshot.bind(store1);
    vi.spyOn(store1, 'persistWorkflowSnapshot').mockImplementation(async args => {
      if (args.workflowName === 'nested' && args.snapshot.status === 'pending') {
        pendingNested = JSON.parse(JSON.stringify(args.snapshot));
      }
      return persist(args);
    });
    let markRunning!: () => void;
    const running = new Promise<void>(r => (markRunning = r));
    const p1 = build(async () => {
      markRunning();
      await new Promise(() => {}); // process "dies" here
    });
    new Mastra({ logger: false, storage: storage1, workflows: { parent: p1.parent, nested: p1.nested } });

    const run1 = await p1.parent.createRun();
    void run1.start({ inputData: {}, initialState: { log: ['parent'] } });
    await running;

    // Recreate the crash window where the nested run only has its pending snapshot.
    const storage2 = new MockStore();
    const store2 = (await storage2.getStore('workflows'))!;
    const parentSnapshot = await store1.loadWorkflowSnapshot({ workflowName: 'parent', runId: run1.runId });
    await store2.persistWorkflowSnapshot({
      workflowName: 'parent',
      runId: run1.runId,
      snapshot: JSON.parse(JSON.stringify(parentSnapshot)),
    });
    expect(pendingNested).toBeDefined();
    await store2.persistWorkflowSnapshot({
      workflowName: 'nested',
      runId: run1.runId,
      snapshot: pendingNested as WorkflowRunState,
    });

    const p2 = build(async () => {});
    new Mastra({ logger: false, storage: storage2, workflows: { parent: p2.parent, nested: p2.nested } });

    const result = await (await p2.parent.createRun({ runId: run1.runId })).restart();

    expect(result.status).toBe('success');
    if (result.status === 'success') {
      expect(result.result).toEqual({ log: ['parent', 'first', 'second'] });
    }
  });

  it('gives each concurrent nested run its own parent state in the pending snapshot', async () => {
    const storage = new MockStore();
    const store = (await storage.getStore('workflows'))!;
    const pending: WorkflowRunState[] = [];
    const persist = store.persistWorkflowSnapshot.bind(store);
    vi.spyOn(store, 'persistWorkflowSnapshot').mockImplementation(async args => {
      if (args.workflowName === 'nested' && args.snapshot.status === 'pending') {
        pending.push(JSON.parse(JSON.stringify(args.snapshot)));
      }
      return persist(args);
    });
    const { parent, nested } = build(async () => {});
    new Mastra({ logger: false, storage, workflows: { parent, nested } });

    const owners = ['a', 'b', 'c', 'd'];
    const runs = await Promise.all(owners.map(() => parent.createRun()));
    await Promise.all(runs.map((run, i) => run.start({ inputData: {}, initialState: { log: [owners[i]!] } })));

    expect(pending.map(snapshot => ({ runId: snapshot.runId, log: snapshot.value.log }))).toEqual(
      expect.arrayContaining(runs.map((run, i) => ({ runId: run.runId, log: [owners[i]] }))),
    );
    expect(pending).toHaveLength(owners.length);
  });
});

type Store = NonNullable<MockStore['stores']['workflows']>;
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
function interceptWrites(store: Store, decide: (args: WriteArgs) => 'write' | 'hang' | 'fail') {
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

/** Lets another process claim the runs a crashed one held. */
async function expireRunLeases(storage: MockStore) {
  const store = storage.stores.workflows!;
  for (const runId of [...(store as unknown as { db: { runOwners: Map<string, unknown> } }).db.runOwners.keys()]) {
    await store.claimRunOwnership({ runId, ownerId: 'lapsed', leaseMs: -1, force: true });
  }
}

/** A run as stored, in either storage version. */
async function loadStored(store: Store, version: 1 | 2, workflowName: string, runId: string) {
  if (version === 1) {
    const snapshot = await store.loadWorkflowSnapshot({ workflowName, runId });
    return snapshot && { ...snapshot, steps: snapshot.context as Record<string, { status: string }> };
  }
  const run = await store.loadWorkflowRun({ workflowName, runId, successfulSteps: 'full' });
  return run && { ...run.header, steps: run.steps };
}

/**
 * The parent saves its nested step as running before the nested run saves its first snapshot, in
 * two separate writes. A crash or a failed write in between leaves a running parent step with no
 * nested run, and restarting the parent failed it with "This workflow run was not active". Found by
 * the workflow-chaos soak main-nostreams-1h.
 */
describe.each([1, 2] as const)('restart when the nested run was never saved (storage v%s)', version => {
  const armState = z.object({ log: z.array(z.string()), a: z.string().optional(), b: z.string().optional() });
  type Built = { workflows: Record<string, AnyWorkflow>; calls: Record<string, number> };

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
   * write and every later write it makes never reach storage. Work that runs inside the returned
   * `revived` (the next process) writes normally. The dead process's leases are expired.
   */
  async function crashAtNestedWrite(
    { workflows }: Built,
    value: unknown,
    lands: (args: WriteArgs) => boolean = args => args.workflowName === 'parent',
  ) {
    const storage = new MockStore();
    // The dead process's work keeps running in this test's process, for example an arm that was
    // still reading when the other arm hit the cut. Async context tells its writes apart from the
    // next process's, so none of them can land after the cut.
    const nextProcess = new AsyncLocalStorage<true>();
    let died = false;
    let markDied!: () => void;
    const dead = new Promise<void>(resolve => (markDied = resolve));
    interceptWrites(storage.stores.workflows!, args => {
      if (nextProcess.getStore()) return 'write';
      if (!died && lands(args)) return 'write';
      died = true;
      markDied();
      return 'hang';
    });
    new Mastra({ logger: false, storage, workflows });
    const run = await workflows.parent!.createRun();
    void run.start({ inputData: { value }, initialState: { log: ['parent'] } });
    await dead;
    await expireRunLeases(storage);
    const revived = <T>(fn: () => Promise<T>) => nextProcess.run(true, fn);
    return { storage, runId: run.runId, revived };
  }

  async function expectNestedStepRunningWithoutNestedRun(storage: MockStore, runId: string) {
    const store = storage.stores.workflows!;
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

  type Revived = <T>(fn: () => Promise<T>) => Promise<T>;

  function restart(built: Built, storage: MockStore, runId: string, revived: Revived = fn => fn()) {
    return revived(async () => {
      new Mastra({ logger: false, storage, workflows: built.workflows });
      return (await built.workflows.parent!.createRun({ runId })).restart();
    });
  }

  it.each([[{ n: 1 }], [null], [0], [false], [''], [undefined]])(
    'runs the nested workflow once with its input %j',
    async value => {
      const { storage, runId, revived } = await crashAtNestedWrite(buildSequential(), value);
      await expectNestedStepRunningWithoutNestedRun(storage, runId);

      const built = buildSequential();
      const result = await restart(built, storage, runId, revived);

      expect(result.status).toBe('success');
      expect(result.status === 'success' && result.result).toEqual({
        log: ['parent', `first:${JSON.stringify(value) ?? 'undefined'}`, 'second'],
      });
      expect(built.calls).toEqual({ first: 1, second: 1 });
      expect((await loadStored(storage.stores.workflows!, version, 'nested', runId))?.status).toBe('success');
    },
  );

  it("runs the nested workflow's onStart once when the nested run was never saved", async () => {
    let onStartCalls = 0;
    const options: Pick<WorkflowOptions, 'onStart'> = { onStart: () => void onStartCalls++ };
    const { storage, runId, revived } = await crashAtNestedWrite(buildSequential(options), { n: 1 });
    await expectNestedStepRunningWithoutNestedRun(storage, runId);
    expect(onStartCalls).toBe(0);

    const built = buildSequential(options);
    const result = await restart(built, storage, runId, revived);

    expect(result.status).toBe('success');
    expect(result.status === 'success' && result.result).toEqual({ log: ['parent', 'first:{"n":1}', 'second'] });
    expect(onStartCalls).toBe(1);
    expect(built.calls).toEqual({ first: 1, second: 1 });
  });

  // The nested run saved its pending snapshot and its onStart accepted it, then the process died
  // before the nested run's first step. onStart already ran, so the restart must not call it again:
  // a gate such as a quota check would reject the recovery.
  it.each([[{ n: 1 }], [null], [0], [false], [''], [undefined]])(
    'does not call onStart again for a nested run it already accepted, with input %j',
    async value => {
      let accepted = 0;
      const options: Pick<WorkflowOptions, 'onStart'> = {
        onStart: () => {
          if (++accepted > 1) throw new Error('quota exceeded');
        },
      };
      const { storage, runId, revived } = await crashAtNestedWrite(
        buildSequential(options),
        value,
        args => args.workflowName === 'parent' || (args.snapshot ?? args.header)?.status === 'pending',
      );
      expect((await loadStored(storage.stores.workflows!, version, 'nested', runId))?.status).toBe('pending');
      expect(accepted).toBe(1);

      const built = buildSequential(options);
      const result = await restart(built, storage, runId, revived);

      expect(result.status).toBe('success');
      expect(result.status === 'success' && result.result).toEqual({
        log: ['parent', `first:${JSON.stringify(value) ?? 'undefined'}`, 'second'],
      });
      expect(accepted).toBe(1);
      expect(built.calls).toEqual({ first: 1, second: 1 });
    },
  );

  it('runs a nested workflow that does not save pending snapshots', async () => {
    const options: Pick<WorkflowOptions, 'shouldPersistSnapshot'> = {
      shouldPersistSnapshot: ({ workflowStatus }) => workflowStatus !== 'pending',
    };
    const { storage, runId, revived } = await crashAtNestedWrite(buildSequential(options), { n: 1 });
    await expectNestedStepRunningWithoutNestedRun(storage, runId);

    const built = buildSequential(options);
    const result = await restart(built, storage, runId, revived);

    expect(result.status).toBe('success');
    expect(result.status === 'success' && result.result).toEqual({ log: ['parent', 'first:{"n":1}', 'second'] });
    expect(built.calls).toEqual({ first: 1, second: 1 });
  });

  it('recovers the run on boot', async () => {
    const { storage, runId, revived } = await crashAtNestedWrite(buildSequential(), { n: 1 });

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

    const parent = await loadStored(storage.stores.workflows!, version, 'parent', runId);
    expect(parent?.status).toBe('success');
    expect(parent?.result).toEqual({ log: ['parent', 'first:{"n":1}', 'second'] });
    expect(built.calls).toEqual({ first: 1, second: 1 });
  });

  it('runs the nested workflow when its first write failed and the worker kept running', async () => {
    const storage = new MockStore();
    // The database drops out at the nested run's first write, so that write and the parent's
    // writes that follow it fail. The process itself keeps running.
    let outage = false;
    const restore = interceptWrites(storage.stores.workflows!, args => {
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
    await expireRunLeases(storage);
    await expectNestedStepRunningWithoutNestedRun(storage, run.runId);

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
      const { storage, runId, revived } = await crashAtNestedWrite(
        buildParallel(),
        { n: 1 },
        args =>
          args.workflowName === 'parent' ||
          (args.workflowName === 'nested-a' && (args.snapshot ?? args.header)?.status === 'pending'),
      );
      const store = storage.stores.workflows!;
      expect((await loadStored(store, version, 'nested-a', runId))?.status).toBe('pending');
      expect(await loadStored(store, version, 'nested-b', runId)).toBeNull();

      const built = buildParallel(slowArm);
      const result = await restart(built, storage, runId, revived);

      expectBothArms(result);
      expect(built.calls).toEqual({ a: 1, b: 1 });
    },
  );

  it('keeps the state of both parallel arms when neither nested run was saved', async () => {
    const { storage, runId, revived } = await crashAtNestedWrite(buildParallel(), { n: 1 });
    expect(await loadStored(storage.stores.workflows!, version, 'nested-a', runId)).toBeNull();
    expect(await loadStored(storage.stores.workflows!, version, 'nested-b', runId)).toBeNull();

    const built = buildParallel('a');
    const result = await restart(built, storage, runId, revived);

    expectBothArms(result);
    expect(built.calls).toEqual({ a: 1, b: 1 });
  });
});
