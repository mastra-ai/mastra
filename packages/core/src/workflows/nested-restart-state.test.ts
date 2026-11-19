/**
 * restart() on a parent whose nested workflow was mid-run must carry the nested
 * run's workflow state back to the parent, like start() and resume() do.
 */

import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { Mastra } from '../mastra';
import { MockStore } from '../storage/mock';
import { createWorkflow } from './create';
import type { WorkflowRunState } from './types';
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

/**
 * The parent saves its nested step as running before the nested run saves its first snapshot, in
 * two separate writes. A crash or a failed write in between leaves a running parent step with no
 * nested run, and restarting the parent failed it with "This workflow run was not active". Found by
 * the workflow-chaos soak main-nostreams-1h.
 */
describe('restart when the nested run was never saved', () => {
  const armState = z.object({ log: z.array(z.string()), a: z.string().optional(), b: z.string().optional() });
  type Built = { workflows: Record<string, AnyWorkflow>; calls: Record<string, number> };

  const readState = () =>
    createStep({
      id: 'read-state',
      inputSchema: z.any(),
      outputSchema: armState,
      stateSchema: armState,
      execute: async ({ state }) => state,
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
  function buildSequential(nestedOptions?: { shouldPersistSnapshot: (args: { workflowStatus: string }) => boolean }) {
    const calls: Record<string, number> = {};
    const logStep = (id: string) =>
      createStep({
        id,
        inputSchema: z.any(),
        outputSchema: z.any(),
        stateSchema: armState,
        execute: async ({ inputData, state, setState }) => {
          calls[id] = (calls[id] ?? 0) + 1;
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
      ...(nestedOptions ? { options: nestedOptions as any } : {}),
    })
      .then(logStep('first'))
      .then(logStep('second'))
      .commit();
    const parent = createWorkflow({
      id: 'parent',
      inputSchema: z.object({ value: z.any() }),
      outputSchema: armState,
      stateSchema: armState,
    })
      .then(prep(calls))
      .then(nested)
      .then(readState())
      .commit();
    return { workflows: { parent, nested }, calls };
  }

  /** `parent`: prep, then `nested-a` and `nested-b` in parallel, each setting its own state key. */
  function buildParallel(): Built {
    const calls: Record<string, number> = {};
    const arm = (key: 'a' | 'b') =>
      createWorkflow({ id: `nested-${key}`, inputSchema: z.any(), outputSchema: z.any(), stateSchema: armState })
        .then(
          createStep({
            id: `set-${key}`,
            inputSchema: z.any(),
            outputSchema: z.any(),
            stateSchema: armState,
            execute: async ({ inputData, state, setState }) => {
              calls[key] = (calls[key] ?? 0) + 1;
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
    })
      .then(prep(calls))
      .parallel([nestedA, nestedB])
      .then(readState())
      .commit();
    return { workflows: { parent, 'nested-a': nestedA, 'nested-b': nestedB }, calls };
  }

  /**
   * Starts `parent` and lets the process die at the first nested write that `lands` rejects: that
   * write and everything after it never reach storage. Returns fresh storage holding what landed.
   */
  async function crashAtNestedWrite(
    { workflows }: Built,
    value: unknown,
    lands: (args: { workflowName: string; snapshot: WorkflowRunState }) => boolean = args =>
      args.workflowName === 'parent',
  ) {
    const storage1 = new MockStore();
    const store1 = storage1.stores.workflows!;
    const persist = store1.persistWorkflowSnapshot.bind(store1);
    let died = false;
    let markDied!: () => void;
    const dead = new Promise<void>(resolve => (markDied = resolve));
    vi.spyOn(store1, 'persistWorkflowSnapshot').mockImplementation(async args => {
      if (died || !lands(args)) {
        died = true;
        markDied();
        return new Promise(() => {});
      }
      return persist({ ...args, snapshot: structuredClone(args.snapshot) });
    });
    new Mastra({ logger: false, storage: storage1, workflows });
    const run = await workflows.parent!.createRun();
    void run.start({ inputData: { value }, initialState: { log: ['parent'] } });
    await dead;

    const storage2 = new MockStore();
    const store2 = storage2.stores.workflows!;
    for (const workflowName of Object.keys(workflows)) {
      const snapshot = await store1.loadWorkflowSnapshot({ workflowName, runId: run.runId });
      if (snapshot) {
        await store2.persistWorkflowSnapshot({
          workflowName,
          runId: run.runId,
          snapshot: JSON.parse(JSON.stringify(snapshot)),
        });
      }
    }
    return { storage: storage2, runId: run.runId };
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

  async function restart(built: Built, storage: InstanceType<typeof MockStore>, runId: string) {
    new Mastra({ logger: false, storage, workflows: built.workflows });
    return (await built.workflows.parent!.createRun({ runId })).restart();
  }

  it.each([[{ n: 1 }], [null], [0], [false], [''], [undefined]])(
    'runs the nested workflow once with its input %j',
    async value => {
      const { storage, runId } = await crashAtNestedWrite(buildSequential(), value);
      const parentSnapshot = await storage.stores.workflows!.loadWorkflowSnapshot({ workflowName: 'parent', runId });
      expect(parentSnapshot?.context.nested?.status).toBe('running');
      expect(await storage.stores.workflows!.loadWorkflowSnapshot({ workflowName: 'nested', runId })).toBeNull();

      const built = buildSequential();
      const result = await restart(built, storage, runId);

      expect(result.status).toBe('success');
      expect(result.status === 'success' && result.result).toEqual({
        log: ['parent', `first:${JSON.stringify(value) ?? 'undefined'}`, 'second'],
      });
      expect(built.calls).toEqual({ first: 1, second: 1 });
      const nested = await storage.stores.workflows!.loadWorkflowSnapshot({ workflowName: 'nested', runId });
      expect(nested?.status).toBe('success');
    },
  );

  it('runs a nested workflow that does not save pending snapshots', async () => {
    const options = {
      shouldPersistSnapshot: ({ workflowStatus }: { workflowStatus: string }) => workflowStatus !== 'pending',
    };
    const { storage, runId } = await crashAtNestedWrite(buildSequential(options), { n: 1 });

    const built = buildSequential(options);
    const result = await restart(built, storage, runId);

    expect(result.status).toBe('success');
    expect(result.status === 'success' && result.result).toEqual({ log: ['parent', 'first:{"n":1}', 'second'] });
    expect(built.calls).toEqual({ first: 1, second: 1 });
  });

  it('recovers the run on boot', async () => {
    const { storage, runId } = await crashAtNestedWrite(buildSequential(), { n: 1 });

    const built = buildSequential();
    // The crash was just now; a zero grace lets recovery restart the run at once.
    await new Mastra({
      logger: false,
      storage,
      workflows: built.workflows,
      recovery: { workflowGraceMs: 0 },
    }).restartAllActiveWorkflowRuns();

    const parent = await storage.stores.workflows!.loadWorkflowSnapshot({ workflowName: 'parent', runId });
    expect(parent?.status).toBe('success');
    expect(parent?.result).toEqual({ log: ['parent', 'first:{"n":1}', 'second'] });
    expect(built.calls).toEqual({ first: 1, second: 1 });
  });

  it('runs the nested workflow when its first write failed and the worker kept running', async () => {
    const storage = new MockStore();
    const store = storage.stores.workflows!;
    const persist = store.persistWorkflowSnapshot.bind(store);
    // The database drops out at the nested run's first write, so that write and the parent's
    // writes that follow it fail. The process itself keeps running.
    let outage = false;
    const writes = vi.spyOn(store, 'persistWorkflowSnapshot').mockImplementation(async args => {
      if (args.workflowName === 'nested') outage = true;
      if (outage) throw new Error('Connection terminated unexpectedly');
      // The in-memory store keeps the snapshot object itself; copy it so later in-memory edits
      // don't show up as stored.
      return persist({ ...args, snapshot: structuredClone(args.snapshot) });
    });
    const first = buildSequential();
    new Mastra({ logger: false, storage, workflows: first.workflows });
    const run = await first.workflows.parent!.createRun();
    await run.start({ inputData: { value: { n: 1 } }, initialState: { log: ['parent'] } }).catch(() => {});
    expect(outage).toBe(true);
    expect(first.calls).toEqual({ prep: 1 });
    writes.mockRestore();
    const stored = await store.loadWorkflowSnapshot({ workflowName: 'parent', runId: run.runId });
    expect(stored?.status).toBe('running');
    expect(stored?.context.nested?.status).toBe('running');
    expect(stored?.activeStepsPath).toHaveProperty('nested');
    expect(await store.loadWorkflowSnapshot({ workflowName: 'nested', runId: run.runId })).toBeNull();

    const built = buildSequential();
    const result = await restart(built, storage, run.runId);

    expect(result.status).toBe('success');
    expect(result.status === 'success' && result.result).toEqual({ log: ['parent', 'first:{"n":1}', 'second'] });
    expect(built.calls).toEqual({ first: 1, second: 1 });
  });

  it('keeps the state of both parallel arms when one nested run was saved and the other was not', async () => {
    // As in the soak's parallel trace: nested-a saved its pending snapshot, nested-b never did.
    const { storage, runId } = await crashAtNestedWrite(
      buildParallel(),
      { n: 1 },
      args =>
        args.workflowName === 'parent' || (args.workflowName === 'nested-a' && args.snapshot.status === 'pending'),
    );
    const store = storage.stores.workflows!;
    expect((await store.loadWorkflowSnapshot({ workflowName: 'nested-a', runId }))?.status).toBe('pending');
    expect(await store.loadWorkflowSnapshot({ workflowName: 'nested-b', runId })).toBeNull();

    const built = buildParallel();
    const result = await restart(built, storage, runId);

    expectBothArms(result);
    expect(built.calls).toEqual({ a: 1, b: 1 });
  });

  it('keeps the state of both parallel arms when neither nested run was saved', async () => {
    const { storage, runId } = await crashAtNestedWrite(buildParallel(), { n: 1 });

    const built = buildParallel();
    const result = await restart(built, storage, runId);

    expectBothArms(result);
    expect(built.calls).toEqual({ a: 1, b: 1 });
  });
});
