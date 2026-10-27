import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { EventEmitterPubSub } from '../events/event-emitter';
import { Mastra } from '../mastra';
import { cloneRunData } from '../storage/domains/workflows/inmemory';
import { MockStore } from '../storage/mock';
import { createWorkflow } from './create';
import { DefaultExecutionEngine } from './default';
import { createWorkflow as createEventedWorkflow } from './evented';
import { createStep } from './workflow';
import type { AnyWorkflow } from './workflow';

function gateStep() {
  return createStep({
    id: 'gate',
    inputSchema: z.object({}),
    outputSchema: z.object({ approved: z.boolean() }),
    resumeSchema: z.boolean(),
    execute: async ({ resumeData, suspend }) => {
      if (resumeData === undefined) return suspend({});
      return { approved: resumeData };
    },
  });
}

function gateWorkflow(storageVersion?: 1 | 2) {
  return createWorkflow({
    id: 'gated',
    inputSchema: z.object({}),
    outputSchema: z.object({ approved: z.boolean() }),
    options: { storageVersion },
  })
    .then(gateStep())
    .commit();
}

function host(storage: InstanceType<typeof MockStore>, workflow: ReturnType<typeof gateWorkflow>) {
  return new Mastra({ logger: false, storage, workflows: { gated: workflow } });
}

describe('storageVersion guards', () => {
  it('rejects storageVersion: 2 together with pruneSnapshot at construction', () => {
    expect(() =>
      createWorkflow({
        id: 'pruned',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        options: { storageVersion: 2, pruneSnapshot: ({ snapshot }) => snapshot },
      }),
    ).toThrow(/storageVersion: 2 and pruneSnapshot/);
  });

  it('rejects storageVersion: 2 on the evented engine at registration', () => {
    const workflow = createEventedWorkflow({
      id: 'evented-v2',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
      options: { storageVersion: 2 },
    })
      .then(createStep({ id: 's', inputSchema: z.object({}), outputSchema: z.object({}), execute: async () => ({}) }))
      .commit();

    expect(() => new Mastra({ logger: false, storage: new MockStore(), workflows: { workflow } })).toThrow(
      /evented engine doesn't support yet/,
    );
  });

  it('rejects storageVersion: 2 at createRun when the store has no journal support', async () => {
    const storage = new MockStore();
    const workflow = gateWorkflow(2);
    host(storage, workflow);
    const store = (await storage.getStore('workflows'))!;
    vi.spyOn(store, 'supportsRunJournal').mockReturnValue(false);

    await expect(workflow.createRun()).rejects.toThrow(/storage adapter doesn't support yet/);
  });

  it('runs a storageVersion: 2 workflow nested in an evented parent on v1, like its parent', async () => {
    const nested = createWorkflow({
      id: 'nested-v2',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
      options: { storageVersion: 2 },
    })
      .then(
        createStep({ id: 'inner', inputSchema: z.object({}), outputSchema: z.object({}), execute: async () => ({}) }),
      )
      .commit();
    const parent = createEventedWorkflow({
      id: 'evented-parent',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
    })
      .then(nested)
      .commit();

    const storage = new MockStore();
    const mastra = new Mastra({ logger: false, storage, pubsub: new EventEmitterPubSub(), workflows: { parent } });
    await mastra.startWorkers();
    try {
      const run = await parent.createRun();
      const result = await run.start({ inputData: {} });

      expect(result.status).toBe('success');
      expect((result as any).steps['nested-v2'].status).toBe('success');
      expect((storage.stores.workflows as any).db.workflowRunHeaders.size).toBe(0);
    } finally {
      await mastra.stopWorkers();
    }
  });
});

describe('storageVersion per run', () => {
  it('takes the version from the workflow definition', async () => {
    const storage = new MockStore();
    const v1 = gateWorkflow();
    host(storage, v1);
    const v1Run = await v1.createRun();
    expect(v1Run.storageVersion).toBe(1);

    const v2 = gateWorkflow(2);
    host(storage, v2);
    const v2Run = await v2.createRun();
    expect(v2Run.storageVersion).toBe(2);

    const store = (await storage.getStore('workflows'))!;
    expect((await store.getWorkflowRunById({ runId: v1Run.runId, workflowName: 'gated' }))?.storageVersion).toBe(
      undefined,
    );
    expect((await store.getWorkflowRunById({ runId: v2Run.runId, workflowName: 'gated' }))?.storageVersion).toBe(2);
  });

  it('passes the run version to the execution engine', async () => {
    const storage = new MockStore();
    const workflow = gateWorkflow();
    host(storage, workflow);
    const execute = vi.spyOn(DefaultExecutionEngine.prototype, 'execute');

    const run = await workflow.createRun();
    await run.start({ inputData: {} });

    expect(execute.mock.calls[0]![0].storageVersion).toBe(1);
    execute.mockRestore();
  });

  it('finishes a v1 run resumed through a v2 definition in v1', async () => {
    const storage = new MockStore();
    const v1 = gateWorkflow(1);
    host(storage, v1);
    const run = await v1.createRun();
    expect((await run.start({ inputData: {} })).status).toBe('suspended');

    const v2 = gateWorkflow(2);
    host(storage, v2);
    const continued = await v2.createRun({ runId: run.runId });
    expect(continued.storageVersion).toBe(1);
    expect((await continued.resume({ step: 'gate', resumeData: true })).status).toBe('success');

    const store = (await storage.getStore('workflows'))!;
    expect(await store.loadWorkflowSnapshot({ workflowName: 'gated', runId: run.runId, storageVersion: 2 })).toBeNull();
    expect(
      (await store.loadWorkflowSnapshot({ workflowName: 'gated', runId: run.runId, storageVersion: 1 }))?.status,
    ).toBe('success');
    // New runs of the v2 definition still take v2.
    expect((await v2.createRun()).storageVersion).toBe(2);
  });

  it('runs, suspends and resumes a v2 run from journal entries', async () => {
    const storage = new MockStore();
    const workflow = gateWorkflow(2);
    host(storage, workflow);
    const run = await workflow.createRun();
    expect((await run.start({ inputData: {} })).status).toBe('suspended');

    const store = (await storage.getStore('workflows'))!;
    const db = (store as any).db;
    const key = `gated-${run.runId}`;
    expect(db.workflows.has(key)).toBe(false);
    expect(db.workflowRunEntries.get(key).length).toBeGreaterThan(0);

    const resumed = await (await workflow.createRun({ runId: run.runId })).resume({ step: 'gate', resumeData: true });
    expect(resumed.status).toBe('success');
    expect(resumed.status === 'success' && resumed.result).toEqual({ approved: true });

    const stored = await store.loadWorkflowSnapshot({ workflowName: 'gated', runId: run.runId });
    expect(stored?.status).toBe('success');
    expect((stored?.context as any).gate).toMatchObject({ status: 'success', output: { approved: true } });
  });

  it('stores a resumed branch step when it ends, before the next step runs', async () => {
    const storage = new MockStore();
    const store = storage.stores.workflows!;
    let storedInNextStep: Awaited<ReturnType<typeof store.loadWorkflowRun>> | undefined;
    const workflow = createWorkflow({
      id: 'branched',
      inputSchema: num,
      outputSchema: z.any(),
      options: { storageVersion: 2 },
    })
      .branch([[async () => true, approveAddOne('approve')]])
      .then(
        createStep({
          id: 'next',
          inputSchema: z.any(),
          outputSchema: z.any(),
          execute: async ({ inputData, runId }) => {
            storedInNextStep = await store.loadWorkflowRun({
              workflowName: 'branched',
              runId,
              successfulSteps: 'full',
            });
            return inputData;
          },
        }),
      )
      .commit();
    new Mastra({ logger: false, storage, workflows: { branched: workflow } });
    const run = await workflow.createRun();
    expect((await run.start({ inputData: { n: 0 } })).status).toBe('suspended');

    const resumed = await (
      await workflow.createRun({ runId: run.runId })
    ).resume({ step: 'approve', resumeData: true });
    expect(resumed.status).toBe('success');
    // What a restart would load if the process died in `next`.
    expect(storedInNextStep?.steps.approve).toMatchObject({ status: 'success', output: { n: 1 } });
  });

  it('reruns the time travel target on restart when the process died right after the checkpoint', async () => {
    const storage = new MockStore();
    const store = storage.stores.workflows!;
    let bRuns = 0;
    const build = () =>
      createWorkflow({ id: 'travelled', inputSchema: num, outputSchema: num, options: { storageVersion: 2 } })
        .then(addOne('a'))
        .then(
          addOne('b', () => {
            bRuns++;
          }),
        )
        .then(addOne('c'))
        .commit();
    const first = build();
    new Mastra({ logger: false, storage, workflows: { travelled: first } });
    const run = await first.createRun();
    expect((await run.start({ inputData: { n: 0 } })).status).toBe('success');

    // The process dies once time travel's checkpoint is stored: no write after it completes.
    let died = false;
    const checkpoint = store.writeWorkflowRunCheckpoint.bind(store);
    store.writeWorkflowRunCheckpoint = async args => {
      const written = await checkpoint(args);
      died = true;
      return written;
    };
    const append = store.appendWorkflowRunEntries.bind(store);
    store.appendWorkflowRunEntries = args => (died ? new Promise(() => {}) : append(args));
    void run.timeTravel({ step: 'b' });
    await vi.waitFor(() => expect(died).toBe(true));
    store.writeWorkflowRunCheckpoint = checkpoint;
    store.appendWorkflowRunEntries = append;

    // The checkpoint still holds b's earlier success; a restart must run b again, not skip to c.
    const second = build();
    new Mastra({ logger: false, storage, workflows: { travelled: second } });
    const restarted = await (await second.createRun({ runId: run.runId })).restart();
    expect(restarted.status).toBe('success');
    expect(bRuns).toBe(2);
  });

  it('restarts a dowhile that died mid-iteration from the state that iteration started with, as v1 does', async () => {
    const seen = z.object({ seen: z.array(z.number()) });
    const build = (storageVersion: 1 | 2, hang?: { at: number; reached: () => void }) =>
      createWorkflow({
        id: 'counted',
        inputSchema: num,
        outputSchema: num,
        stateSchema: seen,
        options: { storageVersion },
      })
        .dowhile(
          createStep({
            id: 'count',
            inputSchema: num,
            outputSchema: num,
            stateSchema: seen,
            execute: async ({ inputData, state, setState }) => {
              if (inputData.n === hang?.at) {
                hang.reached();
                await new Promise(() => {});
              }
              await setState({ seen: [...state.seen, inputData.n] });
              return { n: inputData.n + 1 };
            },
          }),
          async ({ inputData }) => inputData.n < 5,
        )
        .commit();

    const dieAndRestart = async (storageVersion: 1 | 2) => {
      const storage = new MockStore();
      const store = storage.stores.workflows!;
      // v1 keeps the snapshot it was given; clone it so later in-place edits don't show up as stored.
      const persist = store.persistWorkflowSnapshot.bind(store);
      store.persistWorkflowSnapshot = args => persist({ ...args, snapshot: cloneRunData(args.snapshot) });

      // The process dies in the fourth iteration, once its start is stored.
      let died = false;
      const first = build(storageVersion, { at: 3, reached: () => (died = true) });
      new Mastra({ logger: false, storage, workflows: { counted: first } });
      const run = await first.createRun();
      void run.start({ inputData: { n: 0 }, initialState: { seen: [] } });
      await vi.waitFor(() => expect(died).toBe(true));
      const stored = () => store.loadWorkflowSnapshot({ workflowName: 'counted', runId: run.runId });
      const atDeath = await stored();

      const second = build(storageVersion);
      new Mastra({ logger: false, storage, workflows: { counted: second } });
      const restarted = await (await second.createRun({ runId: run.runId })).restart();
      return {
        atDeath: { status: atDeath?.status, state: atDeath?.value },
        restarted: restarted.status,
        state: (await stored())?.value,
      };
    };

    const v1 = await dieAndRestart(1);
    expect(v1).toEqual({
      atDeath: { status: 'running', state: { seen: [0, 1, 2] } },
      restarted: 'success',
      state: { seen: [0, 1, 2, 3, 4] },
    });
    expect(await dieAndRestart(2)).toEqual(v1);
  });

  it('makes no v1 write for a parallel step that starts after the run stopped on a failed write', async () => {
    const storage = new MockStore();
    const store = storage.stores.workflows!;
    let checked!: () => void;
    const checking = new Promise<void>(resolve => (checked = resolve));
    let bRan = false;
    const workflow = createWorkflow({
      id: 'split',
      inputSchema: num,
      outputSchema: z.any(),
      options: { storageVersion: 2 },
    })
      .parallel([
        addOne('a'),
        createStep({
          id: 'b',
          // Checks its input against another service, so it starts after a.
          inputSchema: num.refine(async () => {
            await checking;
            return true;
          }),
          outputSchema: num,
          stateSchema: marks,
          execute: async ({ inputData }) => {
            bRan = true;
            return { n: inputData.n + 1 };
          },
        }),
      ])
      .commit();
    new Mastra({ logger: false, storage, workflows: { split: workflow } });
    const run = await workflow.createRun();

    const appended: string[][] = [];
    const append = store.appendWorkflowRunEntries.bind(store);
    store.appendWorkflowRunEntries = async args => {
      appended.push(Object.keys(args.steps));
      if ('a' in args.steps) throw new Error('store down');
      return append(args);
    };
    const persistSnapshot = vi.spyOn(store, 'persistWorkflowSnapshot');

    // a's start write fails, so the block's Promise.all rejects and the run stops while b checks its input.
    await expect(run.start({ inputData: { n: 0 } })).rejects.toThrow('store down');
    checked();
    await vi.waitFor(() => expect(bRan).toBe(true));

    expect(persistSnapshot).not.toHaveBeenCalled();
    expect(appended).toEqual([['a']]);
  });

  it("drops a stopped run's parallel step write instead of adding it to a later execution of the run", async () => {
    const storage = new MockStore();
    const store = storage.stores.workflows!;
    let checked!: () => void;
    const checking = new Promise<void>(resolve => (checked = resolve));
    const workflow = createWorkflow({
      id: 'split',
      inputSchema: num,
      outputSchema: z.any(),
      options: { storageVersion: 2 },
    })
      .parallel([
        addOne('a'),
        createStep({
          id: 'b',
          inputSchema: num.refine(async () => {
            await checking;
            return true;
          }),
          outputSchema: num,
          stateSchema: marks,
          execute: async ({ inputData }) => ({ n: inputData.n + 1 }),
        }),
      ])
      .commit();
    new Mastra({ logger: false, storage, workflows: { split: workflow } });
    const run = await workflow.createRun();

    const started: string[] = [];
    const append = store.appendWorkflowRunEntries.bind(store);
    store.appendWorkflowRunEntries = async args => {
      for (const [id, result] of Object.entries(args.steps)) {
        if ((result as { status?: string }).status === 'running') started.push(id);
      }
      if (started.length === 1) throw new Error('store down');
      return append(args);
    };

    await expect(run.start({ inputData: { n: 0 } })).rejects.toThrow('store down');
    // Restart the run while the first execution's b still checks its input.
    const restarted = (await workflow.createRun({ runId: run.runId })).restart();
    await vi.waitFor(() => expect(started).toEqual(['a', 'a']));
    checked();

    expect((await restarted).status).toBe('success');
    // Only the restarted execution's b starts in storage.
    expect(started).toEqual(['a', 'a', 'b']);
  });

  it('makes sync getStepResult throw inside v2 steps', async () => {
    const workflow = createWorkflow({
      id: 'sync-read',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
      options: { storageVersion: 2 },
    })
      .then(createStep({ id: 'a', inputSchema: z.object({}), outputSchema: z.object({}), execute: async () => ({}) }))
      .then(
        createStep({
          id: 'b',
          inputSchema: z.object({}),
          outputSchema: z.object({}),
          execute: async ({ getStepResult }) => getStepResult('a'),
        }),
      )
      .commit();
    new Mastra({ logger: false, storage: new MockStore(), workflows: { workflow } });

    const result = await (await workflow.createRun()).start({ inputData: {} });
    expect(result.status).toBe('failed');
    expect((result as any).error.message).toMatch(/Use `await getStepResultAsync\("a"\)` instead/);
  });

  it('finishes a v2 run resumed through a v1 definition in v2', async () => {
    const storage = new MockStore();
    const v2 = gateWorkflow(2);
    host(storage, v2);
    const run = await v2.createRun();
    expect((await run.start({ inputData: {} })).status).toBe('suspended');

    const v1 = gateWorkflow(1);
    host(storage, v1);
    const continued = await v1.createRun({ runId: run.runId });
    expect(continued.storageVersion).toBe(2);
    expect((await continued.resume({ step: 'gate', resumeData: true })).status).toBe('success');

    const store = (await storage.getStore('workflows'))!;
    expect(await store.loadWorkflowSnapshot({ workflowName: 'gated', runId: run.runId, storageVersion: 1 })).toBeNull();
    expect(
      (await store.loadWorkflowSnapshot({ workflowName: 'gated', runId: run.runId, storageVersion: 2 }))?.status,
    ).toBe('success');
  });

  it('keeps a v1 run on v1 when storageVersion: 2 is set on a store without run journals', async () => {
    const storage = new MockStore();
    const v1 = gateWorkflow(1);
    host(storage, v1);
    const run = await v1.createRun();
    expect((await run.start({ inputData: {} })).status).toBe('suspended');

    const store = (await storage.getStore('workflows'))!;
    vi.spyOn(store, 'supportsRunJournal').mockReturnValue(false);

    const v2 = gateWorkflow(2);
    host(storage, v2);
    const continued = await v2.createRun({ runId: run.runId });
    expect(continued.storageVersion).toBe(1);
    expect((await continued.resume({ step: 'gate', resumeData: true })).status).toBe('success');
    await expect(v2.createRun()).rejects.toThrow(/storage adapter/i);
  });
});

describe('autoStorageVersion', () => {
  function autoGated(options: { storageVersion?: 1 | 2; pruneSnapshot?: (args: { snapshot: any }) => any } = {}) {
    return createWorkflow({
      id: 'gated',
      inputSchema: z.object({}),
      outputSchema: z.object({ approved: z.boolean() }),
      options: { autoStorageVersion: true, ...options },
    })
      .then(gateStep())
      .commit();
  }

  it("stores a new run as v2 on a store with run journals, so it doesn't prune", async () => {
    const storage = new MockStore();
    const prune = vi.fn(({ snapshot }) => snapshot);
    const workflow = autoGated({ pruneSnapshot: prune });
    host(storage, workflow);

    const run = await workflow.createRun();
    expect(run.storageVersion).toBe(2);
    expect((await run.start({ inputData: {} })).status).toBe('suspended');
    expect(prune).not.toHaveBeenCalled();

    const store = (await storage.getStore('workflows'))!;
    expect(await store.loadWorkflowSnapshot({ workflowName: 'gated', runId: run.runId, storageVersion: 1 })).toBeNull();
    expect((await store.loadWorkflowRunHeader({ workflowName: 'gated', runId: run.runId }))?.header.status).toBe(
      'suspended',
    );
  });

  it('stores a new run as v1 on a store without run journals, and prunes it', async () => {
    const storage = new MockStore();
    const prune = vi.fn(({ snapshot }) => snapshot);
    const workflow = autoGated({ pruneSnapshot: prune });
    host(storage, workflow);
    const store = (await storage.getStore('workflows'))!;
    vi.spyOn(store, 'supportsRunJournal').mockReturnValue(false);

    const run = await workflow.createRun();
    expect(run.storageVersion).toBe(1);
    expect((await run.start({ inputData: {} })).status).toBe('suspended');
    expect(prune).toHaveBeenCalled();
    expect(
      (await store.loadWorkflowSnapshot({ workflowName: 'gated', runId: run.runId, storageVersion: 1 }))?.status,
    ).toBe('suspended');
  });

  it('stores a new run as v1 on the evented engine', async () => {
    const workflow = createEventedWorkflow({
      id: 'evented-auto',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
      options: { autoStorageVersion: true },
    })
      .then(createStep({ id: 's', inputSchema: z.object({}), outputSchema: z.object({}), execute: async () => ({}) }))
      .commit();
    const storage = new MockStore();
    const mastra = new Mastra({ logger: false, storage, pubsub: new EventEmitterPubSub(), workflows: { workflow } });
    await mastra.startWorkers();
    try {
      const run = await workflow.createRun();
      expect(run.storageVersion).toBe(1);
      expect((await run.start({ inputData: {} })).status).toBe('success');
      expect((storage.stores.workflows as any).db.workflowRunHeaders.size).toBe(0);
    } finally {
      await mastra.stopWorkers();
    }
  });

  it('leaves the version to an explicit storageVersion', async () => {
    const storage = new MockStore();
    const workflow = autoGated({ storageVersion: 1 });
    host(storage, workflow);
    expect((await workflow.createRun()).storageVersion).toBe(1);
  });

  it('finishes a v1 run stored before it was set in v1', async () => {
    const storage = new MockStore();
    const before = gateWorkflow();
    host(storage, before);
    const run = await before.createRun();
    expect((await run.start({ inputData: {} })).status).toBe('suspended');

    const after = autoGated();
    host(storage, after);
    const continued = await after.createRun({ runId: run.runId });
    expect(continued.storageVersion).toBe(1);
    expect((await continued.resume({ step: 'gate', resumeData: true })).status).toBe('success');
    expect((storage.stores.workflows as any).db.workflowRunHeaders.size).toBe(0);
    expect((await after.createRun()).storageVersion).toBe(2);
  });
});

const num = z.object({ n: z.number() });
const marks = z.object({ marked: z.number().optional() });
const items = z.object({ items: z.array(z.string()) });
/** A first item that keeps one appended item's patch smaller than the state, so nested runs keep inheriting it. */
const PAD = '.'.repeat(512);

function addOne(id: string, onRun?: (ctx: { setState: (state: z.infer<typeof marks>) => Promise<void> }) => unknown) {
  return createStep({
    id,
    inputSchema: num,
    outputSchema: num,
    stateSchema: marks,
    execute: async ({ inputData, setState }) => {
      await onRun?.({ setState });
      return { n: inputData.n + 1 };
    },
  });
}

/** Appends `<id>:<n>` to `state.items` after `onRun`; with `suspends`, only once resumed. */
function appendItem(id: string, { suspends = false, onRun }: { suspends?: boolean; onRun?: () => unknown } = {}) {
  return createStep({
    id,
    inputSchema: num,
    outputSchema: num,
    stateSchema: items,
    resumeSchema: z.boolean(),
    execute: async ({ inputData, state, setState, resumeData, suspend }) => {
      if (suspends && resumeData === undefined) return suspend({});
      await onRun?.();
      await setState({ items: [...state.items, `${id}:${inputData.n}`] });
      return { n: inputData.n + 1 };
    },
  });
}

/** `outer` appends, then runs `inner`, which appends, suspends until resumed, and appends again. */
function suspendingNested(storageVersion: 1 | 2) {
  const inner = createWorkflow({
    id: 'inner',
    inputSchema: num,
    outputSchema: num,
    stateSchema: items,
    options: { storageVersion },
  })
    .then(appendItem('inner-a'))
    .then(appendItem('inner-wait', { suspends: true }))
    .then(appendItem('inner-b'))
    .commit();
  const outer = createWorkflow({
    id: 'outer',
    inputSchema: num,
    outputSchema: num,
    stateSchema: items,
    options: { storageVersion },
  })
    .then(appendItem('before'))
    .then(inner)
    .commit();
  return { outer, inner };
}

/** Records each storage v2 write's changes, and returns a run's stored entries. */
function recordV2Writes(storage: InstanceType<typeof MockStore>) {
  const store = storage.stores.workflows!;
  const writes: { status: string; changes?: { stepIds: string[]; state: boolean } }[] = [];
  const checkpoint = store.writeWorkflowRunCheckpoint.bind(store);
  store.writeWorkflowRunCheckpoint = async args => {
    writes.push({ status: args.header.status });
    return checkpoint(args);
  };
  const append = store.appendWorkflowRunEntries.bind(store);
  store.appendWorkflowRunEntries = async args => {
    writes.push({
      status: args.header.status,
      changes: { stepIds: Object.keys(args.steps), state: args.state !== undefined || args.statePatch !== undefined },
    });
    return append(args);
  };
  const entries = (workflowName: string, runId: string): { kind: string; stepId?: string }[] =>
    (store as any).db.workflowRunEntries.get(`${workflowName}-${runId}`);
  return { writes, entries };
}

describe('storage v2 write volume', () => {
  const STEPS = 20;

  it('appends only the changed step per write, and state only when it changed', async () => {
    const storage = new MockStore();
    const { writes, entries } = recordV2Writes(storage);
    let workflow: any = createWorkflow({
      id: 'sequential',
      inputSchema: num,
      outputSchema: num,
      stateSchema: marks,
      options: { storageVersion: 2 },
    });
    for (let i = 0; i < STEPS; i++) {
      workflow = workflow.then(addOne(`s${i}`, i === 10 ? ({ setState }) => setState({ marked: i }) : undefined));
    }
    workflow.commit();
    new Mastra({ logger: false, storage, workflows: { sequential: workflow } });

    const run = await workflow.createRun();
    const result = await run.start({ inputData: { n: 0 }, initialState: {} });
    expect(result.status).toBe('success');
    expect(result.result).toEqual({ n: STEPS });

    // createRun's pending write and the running write before the first step are checkpoints; every later write is an append.
    expect(writes.slice(0, 2).map(w => w.changes)).toEqual([undefined, undefined]);
    const appends = writes.slice(2);
    expect(appends.every(w => w.changes)).toBe(true);
    for (const { status, changes } of appends) {
      expect(changes!.stepIds).toHaveLength(status === 'running' ? 1 : 0);
    }
    // The run ends with the state s10 set, so the end sends no state.
    expect(appends.filter(w => w.changes!.state)).toEqual([
      { status: 'running', changes: { stepIds: ['s10'], state: true } },
    ]);

    // One entry per step start and finish, plus the input, plus state at the checkpoint and after setState.
    const stored = entries('sequential', run.runId);
    expect(stored.filter(e => e.kind === 'step')).toHaveLength(2 * STEPS + 1);
    expect(stored.filter(e => e.kind === 'state' || e.kind === 'state-patch')).toHaveLength(2);
  });

  it('appends one entry per dowhile iteration', async () => {
    const storage = new MockStore();
    const { writes, entries } = recordV2Writes(storage);
    const workflow = createWorkflow({ id: 'loop', inputSchema: num, outputSchema: num, options: { storageVersion: 2 } })
      .dowhile(addOne('count'), async ({ inputData }) => inputData.n < STEPS)
      .commit();
    new Mastra({ logger: false, storage, workflows: { loop: workflow } });

    const run = await workflow.createRun();
    const result = await run.start({ inputData: { n: 0 } });
    expect(result.status).toBe('success');
    expect(result.status === 'success' && result.result).toEqual({ n: STEPS });

    // One append per iteration start, and one when the loop ends.
    const appends = writes.filter(w => w.changes);
    expect(appends.filter(w => w.status === 'running').map(w => w.changes)).toEqual(
      Array.from({ length: STEPS + 1 }, () => ({ stepIds: ['count'], state: false })),
    );

    // The checkpoint holds the input and the state; then one entry per append above. The state never changes.
    const stored = entries('loop', run.runId);
    expect(stored.filter(e => e.kind === 'step')).toHaveLength(STEPS + 2);
    expect(stored.filter(e => e.kind === 'state' || e.kind === 'state-patch')).toHaveLength(1);
  });

  it('stores state bytes linear in the final state when every loop iteration appends to it', async () => {
    /** The JSON size of every state and state patch the run sent, and of its final state. */
    async function stateBytes(iterations: number) {
      const storage = new MockStore();
      const store = storage.stores.workflows!;
      let sent = 0;
      const count = (args: { state?: unknown; statePatch?: unknown }) => {
        if (args.state) sent += JSON.stringify(args.state).length;
        if (args.statePatch) sent += JSON.stringify(args.statePatch).length;
      };
      const checkpoint = store.writeWorkflowRunCheckpoint.bind(store);
      store.writeWorkflowRunCheckpoint = async args => (count(args), checkpoint(args));
      const append = store.appendWorkflowRunEntries.bind(store);
      store.appendWorkflowRunEntries = async args => (count(args), append(args));

      const appendItem = createStep({
        id: 'append',
        inputSchema: num,
        outputSchema: num,
        stateSchema: items,
        execute: async ({ inputData, state, setState }) => {
          await setState({ items: [...state.items, String(inputData.n % 10).repeat(1024)] });
          return { n: inputData.n + 1 };
        },
      });
      const workflow = createWorkflow({
        id: 'growing',
        inputSchema: num,
        outputSchema: num,
        stateSchema: items,
        options: { storageVersion: 2 },
      })
        .dowhile(appendItem, async ({ inputData }) => inputData.n < iterations)
        .commit();
      new Mastra({ logger: false, storage, workflows: { growing: workflow } });

      const run = await workflow.createRun();
      const result = await run.start({ inputData: { n: 0 }, initialState: { items: [] } });
      expect(result.status).toBe('success');
      const stored = await store.loadWorkflowRun({
        workflowName: 'growing',
        runId: run.runId,
        successfulSteps: 'full',
      });
      expect(stored!.state.items).toHaveLength(iterations);
      return { sent, final: JSON.stringify(stored!.state).length };
    }

    const runs = [4, 8, 16].map(stateBytes);
    for (const { sent, final } of await Promise.all(runs)) {
      // Writing the whole state on every write would send about iterations / 2 times the final state.
      expect(sent).toBeLessThanOrEqual(2 * final);
    }
  });

  it('keeps the patches after the latest full state within the state size across suspend and resume cycles', async () => {
    const storage = new MockStore();
    const store = storage.stores.workflows!;
    const kb = (i: number) => String(i % 10).repeat(1024);
    const quarters = z.object({ a: z.string(), b: z.string(), c: z.string(), d: z.string() });
    const edit = createStep({
      id: 'edit',
      inputSchema: num,
      outputSchema: num,
      stateSchema: quarters,
      execute: async ({ inputData, state, setState, resumeData, suspend }) => {
        if (resumeData === undefined) return suspend({});
        await setState({ ...state, a: kb(inputData.n + 1) });
        return { n: inputData.n + 1 };
      },
    });
    const workflow = createWorkflow({
      id: 'cycles',
      inputSchema: num,
      outputSchema: num,
      stateSchema: quarters,
      options: { storageVersion: 2 },
    })
      .dowhile(edit, async ({ inputData }) => inputData.n < 12)
      .commit();
    new Mastra({ logger: false, storage, workflows: { cycles: workflow } });

    const initialState = { a: kb(0), b: kb(0), c: kb(0), d: kb(0) };
    const size = JSON.stringify(initialState).length;
    const run = await workflow.createRun();
    let result = await run.start({ inputData: { n: 0 }, initialState });
    for (let i = 1; i <= 12; i++) {
      expect(result.status).toBe('suspended');
      // Each cycle is a new journal, which continues from the patch bytes the store reported.
      result = await (await workflow.createRun({ runId: run.runId })).resume({ step: 'edit', resumeData: true });
      const stored = await store.loadWorkflowRun({ workflowName: 'cycles', runId: run.runId, successfulSteps: 'full' });
      expect(stored!.state.a).toBe(kb(i));
      expect(stored!.statePatchBytes).toBeLessThanOrEqual(size);
    }
    expect(result.status).toBe('success');
  });

  it('keeps the patches after the latest full state within the state size across restarts', async () => {
    const storage = new MockStore();
    const store = storage.stores.workflows!;
    const kb = (i: number) => String(i % 10).repeat(1024);
    const quarters = z.object({ a: z.string(), b: z.string(), c: z.string(), d: z.string() });
    const build = (hang?: { at: number; reached: () => void }) =>
      createWorkflow({
        id: 'restarted',
        inputSchema: num,
        outputSchema: num,
        stateSchema: quarters,
        options: { storageVersion: 2 },
      })
        .dowhile(
          createStep({
            id: 'edit',
            inputSchema: num,
            outputSchema: num,
            stateSchema: quarters,
            execute: async ({ inputData, state, setState }) => {
              if (inputData.n === hang?.at) {
                hang.reached();
                await new Promise(() => {});
              }
              await setState({ ...state, a: kb(inputData.n + 1) });
              return { n: inputData.n + 1 };
            },
          }),
          async ({ inputData }) => inputData.n < 8,
        )
        .commit();

    const initialState = { a: kb(0), b: kb(0), c: kb(0), d: kb(0) };
    const size = JSON.stringify(initialState).length;
    let runId: string | undefined;
    // Each process dies in the next iteration, once its start is stored; the next process restarts the run.
    for (let life = 1; life < 8; life++) {
      let died = false;
      const workflow = build({ at: life, reached: () => (died = true) });
      new Mastra({ logger: false, storage, workflows: { restarted: workflow } });
      if (runId === undefined) {
        const run = await workflow.createRun();
        runId = run.runId;
        void run.start({ inputData: { n: 0 }, initialState });
      } else {
        void (await workflow.createRun({ runId })).restart();
      }
      await vi.waitFor(() => expect(died).toBe(true));
      const stored = await store.loadWorkflowRun({ workflowName: 'restarted', runId, successfulSteps: 'full' });
      expect(stored!.state.a).toBe(kb(life));
      expect(stored!.statePatchBytes).toBeLessThanOrEqual(size);
    }

    const last = build();
    new Mastra({ logger: false, storage, workflows: { restarted: last } });
    const result = await (await last.createRun({ runId })).restart();
    expect(result.status).toBe('success');
  });
});

const TIMESTAMP_KEYS = new Set(['startedAt', 'endedAt', 'suspendedAt', 'resumedAt', 'timestamp']);

function withoutTimestamps(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutTimestamps);
  if (!value || typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype) return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !TIMESTAMP_KEYS.has(key))
      .map(([key, v]) => [key, withoutTimestamps(v)]),
  );
}

type Scenario = {
  build: (storageVersion: 1 | 2) => AnyWorkflow;
  drive: (workflow: AnyWorkflow, runId: string) => Promise<unknown>;
};

const startOnly: Scenario['drive'] = async (workflow, runId) =>
  (await workflow.createRun({ runId })).start({ inputData: { n: 0 }, initialState: {} });

const startWithItems: Scenario['drive'] = async (workflow, runId) =>
  (await workflow.createRun({ runId })).start({ inputData: { n: 0 }, initialState: { items: [PAD] } });

/** Runs a scenario on one storage version and returns its result plus every run it stored. */
async function runAndReadBack(storageVersion: 1 | 2, { build, drive }: Scenario) {
  const storage = new MockStore();
  const store = storage.stores.workflows!;
  if (storageVersion === 1) {
    // v1 keeps the snapshot it was given, so clone it: an in-place edit after a write then shows up as a v1/v2 difference.
    const persist = store.persistWorkflowSnapshot.bind(store);
    store.persistWorkflowSnapshot = args => persist({ ...args, snapshot: cloneRunData(args.snapshot) });
  }
  const workflow = build(storageVersion);
  new Mastra({ logger: false, storage, workflows: { [workflow.id]: workflow } });
  const result = await drive(workflow, 'run-1');

  const db = (store as any).db;
  const rows: { workflow_name: string; run_id: string }[] = [
    ...(storageVersion === 1 ? db.workflows : db.workflowRunHeaders).values(),
  ];
  const runs: Record<string, unknown> = {};
  for (const { workflow_name, run_id } of rows) {
    runs[`${workflow_name}/${run_id}`] = withoutTimestamps(
      await store.loadWorkflowSnapshot({ workflowName: workflow_name, runId: run_id, storageVersion }),
    );
  }
  return { result: withoutTimestamps(result), runs };
}

const scenarios: Record<string, Scenario> = {
  'sequential steps with state and a map': {
    build: storageVersion =>
      createWorkflow({
        id: 'sequential',
        inputSchema: num,
        outputSchema: num,
        stateSchema: marks,
        options: { storageVersion },
      })
        .then(addOne('a'))
        .then(addOne('b', ({ setState }) => setState({ marked: 1 })))
        .map(async ({ inputData }) => ({ n: inputData.n * 10 }))
        .then(addOne('c'))
        .commit(),
    drive: startOnly,
  },
  'parallel and branch': {
    build: storageVersion =>
      createWorkflow({ id: 'fan', inputSchema: num, outputSchema: z.any(), options: { storageVersion } })
        .parallel([addOne('left'), addOne('right')])
        .map(async ({ inputData }) => ({ n: inputData.left.n + inputData.right.n }))
        .branch([
          [async ({ inputData }) => inputData.n > 1, addOne('big')],
          [async ({ inputData }) => inputData.n <= 1, addOne('small')],
        ])
        .commit(),
    drive: startOnly,
  },
  'dowhile and foreach': {
    build: storageVersion =>
      createWorkflow({ id: 'loops', inputSchema: num, outputSchema: z.any(), options: { storageVersion } })
        .dowhile(addOne('count'), async ({ inputData }) => inputData.n < 3)
        .map(async ({ inputData }) => [{ n: inputData.n }, { n: inputData.n * 2 }])
        .foreach(addOne('each'), { concurrency: 2 })
        .commit(),
    drive: startOnly,
  },
  'nested workflow': {
    build: storageVersion => {
      const nested = createWorkflow({
        id: 'inner',
        inputSchema: num,
        outputSchema: num,
        stateSchema: marks,
        options: { storageVersion },
      })
        .then(addOne('inner-a', ({ setState }) => setState({ marked: 2 })))
        .then(addOne('inner-b'))
        .commit();
      return createWorkflow({
        id: 'outer',
        inputSchema: num,
        outputSchema: num,
        stateSchema: marks,
        options: { storageVersion },
      })
        .then(addOne('before'))
        .then(nested)
        .then(addOne('after'))
        .commit();
    },
    drive: startOnly,
  },
  'nested workflow in a dowhile, appending to the state': {
    build: storageVersion => {
      const inner = createWorkflow({
        id: 'inner',
        inputSchema: num,
        outputSchema: num,
        stateSchema: items,
        options: { storageVersion },
      })
        .then(appendItem('inner-add'))
        .commit();
      return createWorkflow({
        id: 'outer',
        inputSchema: num,
        outputSchema: num,
        stateSchema: items,
        options: { storageVersion },
      })
        .then(appendItem('before'))
        .dowhile(inner, async ({ inputData }) => inputData.n < 4)
        .commit();
    },
    drive: startWithItems,
  },
  'a suspended nested workflow': {
    build: storageVersion => suspendingNested(storageVersion).outer,
    drive: startWithItems,
  },
  'a nested workflow resumed through its parent': {
    build: storageVersion => suspendingNested(storageVersion).outer,
    drive: async (workflow, runId) => {
      await startWithItems(workflow, runId);
      return (await workflow.createRun({ runId })).resume({ step: ['inner', 'inner-wait'], resumeData: true });
    },
  },
  'time travel into a nested step': {
    build: storageVersion => {
      const inner = createWorkflow({
        id: 'inner',
        inputSchema: num,
        outputSchema: num,
        stateSchema: items,
        options: { storageVersion },
      })
        .then(appendItem('inner-a'))
        .then(appendItem('inner-b'))
        .commit();
      return createWorkflow({
        id: 'outer',
        inputSchema: num,
        outputSchema: num,
        stateSchema: items,
        options: { storageVersion },
      })
        .then(appendItem('before'))
        .then(inner)
        .commit();
    },
    drive: async (workflow, runId) => {
      await startWithItems(workflow, runId);
      return (await workflow.createRun({ runId })).timeTravel({ step: ['inner', 'inner-b'], inputData: { n: 10 } });
    },
  },
  "a nested workflow whose state schema strips and defaults the parent's keys": {
    build: storageVersion => {
      const inner = createWorkflow({
        id: 'inner',
        inputSchema: num,
        outputSchema: num,
        stateSchema: z.object({ items: z.array(z.string()), innerOnly: z.string().default('default') }),
        options: { storageVersion },
      })
        .then(appendItem('inner-add'))
        .commit();
      return createWorkflow({
        id: 'outer',
        inputSchema: num,
        outputSchema: num,
        stateSchema: z.object({ items: z.array(z.string()), outerOnly: z.string() }),
        options: { storageVersion },
      })
        .then(appendItem('before'))
        .then(inner as any)
        .commit();
    },
    drive: async (workflow, runId) =>
      (await workflow.createRun({ runId })).start({
        inputData: { n: 0 },
        initialState: { items: [PAD], outerOnly: 'o' },
      }),
  },
  'suspend and resume': {
    build: storageVersion => gateWorkflow(storageVersion),
    drive: async (workflow, runId) => {
      await (await workflow.createRun({ runId })).start({ inputData: {} });
      return (await workflow.createRun({ runId })).resume({ step: 'gate', resumeData: true });
    },
  },
  'in-place state edits around a suspend': {
    build: storageVersion => {
      const push = (id: string, edit: (state: { items: string[] }, resumed: boolean) => void, suspends = false) =>
        createStep({
          id,
          inputSchema: z.any(),
          outputSchema: z.any(),
          stateSchema: items,
          execute: async ({ state, resumeData, suspend }) => {
            edit(state, resumeData !== undefined);
            if (suspends && resumeData === undefined) return suspend({});
            return {};
          },
        });
      return createWorkflow({
        id: 'editing',
        inputSchema: z.any(),
        outputSchema: z.any(),
        stateSchema: items,
        options: { storageVersion },
      })
        .then(push('first', state => state.items.push('first')))
        .then(push('wait', (state, resumed) => state.items.push(resumed ? 'resumed' : 'waiting'), true))
        .then(push('last', state => (state.items[0] = 'edited')))
        .commit();
    },
    drive: async (workflow, runId) => {
      await (await workflow.createRun({ runId })).start({ inputData: {}, initialState: { items: [] } });
      return (await workflow.createRun({ runId })).resume({ step: 'wait', resumeData: true });
    },
  },
  bail: {
    build: storageVersion =>
      createWorkflow({ id: 'bailing', inputSchema: num, outputSchema: num, options: { storageVersion } })
        .then(addOne('first'))
        .then(
          createStep({
            id: 'stop',
            inputSchema: num,
            outputSchema: num,
            execute: async ({ inputData, bail }) => bail({ n: inputData.n * 100 }),
          }),
        )
        .then(addOne('never'))
        .commit(),
    drive: startOnly,
  },
  'a failing step': {
    build: storageVersion =>
      createWorkflow({ id: 'failing', inputSchema: num, outputSchema: num, options: { storageVersion } })
        .then(addOne('ok'))
        .then(
          createStep({
            id: 'boom',
            inputSchema: num,
            outputSchema: num,
            execute: async () => {
              throw new Error('boom');
            },
          }),
        )
        .commit(),
    drive: startOnly,
  },
};

describe('storage v2 stores the same runs as v1', () => {
  for (const [name, scenario] of Object.entries(scenarios)) {
    it(name, async () => {
      const v1 = await runAndReadBack(1, scenario);
      const v2 = await runAndReadBack(2, scenario);
      expect(Object.keys(v1.runs).length).toBeGreaterThan(0);
      expect(v2).toEqual(v1);
    });
  }
});

/** Records, per storage v2 write, whether it sent the full state, a patch or neither, and its JSON size. */
function recordStateSends(storage: InstanceType<typeof MockStore>) {
  const store = storage.stores.workflows!;
  const sends: {
    workflowName: string;
    runId: string;
    status: string;
    checkpoint: boolean;
    state: string;
    bytes: number;
  }[] = [];
  const record = (
    checkpoint: boolean,
    args: {
      workflowName: string;
      runId: string;
      header: { status: string };
      state?: unknown;
      statePatch?: unknown;
    },
  ) => {
    const sent = args.state ?? args.statePatch;
    sends.push({
      workflowName: args.workflowName,
      runId: args.runId,
      status: args.header.status,
      checkpoint,
      state: args.state !== undefined ? 'full' : args.statePatch !== undefined ? 'patch' : 'none',
      bytes: sent === undefined ? 0 : JSON.stringify(sent).length,
    });
  };
  const checkpoint = store.writeWorkflowRunCheckpoint.bind(store);
  store.writeWorkflowRunCheckpoint = async args => (record(true, args), checkpoint(args));
  const append = store.appendWorkflowRunEntries.bind(store);
  store.appendWorkflowRunEntries = async args => (record(false, args), append(args));
  return sends;
}

/** What each nested run's checkpoints sent as state, in write order. */
function innerCheckpoints(sends: ReturnType<typeof recordStateSends>) {
  const byRun = new Map<string, string[]>();
  for (const { workflowName, runId, checkpoint, state } of sends) {
    if (workflowName !== 'inner' || !checkpoint) continue;
    byRun.set(runId, [...(byRun.get(runId) ?? []), state]);
  }
  return [...byRun.values()];
}

/** Every stored run's status and state. */
async function storedStates(storage: InstanceType<typeof MockStore>, storageVersion: 1 | 2) {
  const store = storage.stores.workflows!;
  const db = (store as any).db;
  const rows: { workflow_name: string; run_id: string }[] = [
    ...db.workflows.values(),
    ...db.workflowRunHeaders.values(),
  ];
  const states: Record<string, unknown> = {};
  for (const { workflow_name, run_id } of rows) {
    const snapshot = await store.loadWorkflowSnapshot({ workflowName: workflow_name, runId: run_id, storageVersion });
    states[`${workflow_name}/${run_id}`] = { status: snapshot?.status, state: snapshot?.value };
  }
  return states;
}

describe('storage v2 nested runs', () => {
  it.each([
    ['sets storageVersion: 2', { storageVersion: 2 }],
    ["doesn't set a storage version", {}],
  ] as const)(
    "stores a nested run's state as changes to its parent's, so a loop over it stores bytes linear in the state, when the nested workflow %s",
    async (_, innerOptions) => {
      async function nestedLoop(iterations: number) {
        const storage = new MockStore();
        const sends = recordStateSends(storage);
        const append = createStep({
          id: 'append',
          inputSchema: num,
          outputSchema: num,
          stateSchema: items,
          execute: async ({ inputData, state, setState }) => {
            await setState({ items: [...state.items, String(inputData.n % 10).repeat(1024)] });
            return { n: inputData.n + 1 };
          },
        });
        const inner = createWorkflow({
          id: 'inner',
          inputSchema: num,
          outputSchema: num,
          stateSchema: items,
          options: innerOptions,
        })
          .then(append)
          .commit();
        const outer = createWorkflow({
          id: 'outer',
          inputSchema: num,
          outputSchema: num,
          stateSchema: items,
          options: { storageVersion: 2 },
        })
          .dowhile(inner, async ({ inputData }) => inputData.n < iterations)
          .commit();
        new Mastra({ logger: false, storage, workflows: { outer } });

        const run = await outer.createRun();
        expect((await run.start({ inputData: { n: 0 }, initialState: { items: [] } })).status).toBe('success');
        const store = storage.stores.workflows!;
        const load = (workflowName: string) =>
          store.loadWorkflowRun({ workflowName, runId: run.runId, successfulSteps: 'full' });
        const [outerRun, innerRun] = await Promise.all([load('outer'), load('inner')]);
        expect(outerRun!.state.items).toHaveLength(iterations);
        expect(innerRun!.state).toEqual(outerRun!.state);
        return {
          innerCheckpoints: innerCheckpoints(sends),
          sent: sends.reduce((sum, { bytes }) => sum + bytes, 0),
          final: JSON.stringify(outerRun!.state).length,
        };
      }

      for (const iterations of [4, 8, 16]) {
        const { innerCheckpoints, sent, final } = await nestedLoop(iterations);
        // Every iteration re-checkpoints the nested run, which reuses the parent's run id.
        expect(innerCheckpoints).toEqual([Array(iterations + 1).fill('none')]);
        // Copying the state into every iteration's checkpoint would send about iterations / 2 times the final state.
        expect(sent).toBeLessThanOrEqual(2.5 * final);
      }
    },
  );

  describe.each(['restart', 'restartAllActiveWorkflowRuns'] as const)('a nested run that died mid-step', how => {
    it(`rebuilds its state from the parent's stored state on ${how}, as v1 does`, async () => {
      const build = (storageVersion: 1 | 2, died?: () => void) => {
        const inner = createWorkflow({
          id: 'inner',
          inputSchema: num,
          outputSchema: num,
          stateSchema: items,
          options: { storageVersion },
        })
          .then(appendItem('inner-a'))
          .then(
            appendItem('inner-b', {
              onRun: died && (() => (died(), new Promise(() => {}))),
            }),
          )
          .commit();
        return createWorkflow({
          id: 'outer',
          inputSchema: num,
          outputSchema: num,
          stateSchema: items,
          options: { storageVersion },
        })
          .then(appendItem('before'))
          .then(inner)
          .commit();
      };

      const dieAndRestart = async (storageVersion: 1 | 2) => {
        const storage = new MockStore();
        const store = storage.stores.workflows!;
        const persist = store.persistWorkflowSnapshot.bind(store);
        store.persistWorkflowSnapshot = args => persist({ ...args, snapshot: cloneRunData(args.snapshot) });

        let died = false;
        const first = build(storageVersion, () => (died = true));
        new Mastra({ logger: false, storage, workflows: { outer: first } });
        void (await first.createRun({ runId: 'run-1' })).start({ inputData: { n: 0 }, initialState: { items: [PAD] } });
        await vi.waitFor(() => expect(died).toBe(true));

        const second = build(storageVersion);
        new Mastra({ logger: false, storage, workflows: { outer: second } });
        if (how === 'restart') {
          expect((await (await second.createRun({ runId: 'run-1' })).restart()).status).toBe('success');
        } else {
          await second.restartAllActiveWorkflowRuns();
        }
        return storedStates(storage, storageVersion);
      };

      const v1 = await dieAndRestart(1);
      const state = { items: [PAD, 'before:0', 'inner-a:1', 'inner-b:2'] };
      expect(v1).toEqual({
        'outer/run-1': { status: 'success', state },
        'inner/run-1': { status: 'success', state },
      });
      expect(await dieAndRestart(2)).toEqual(v1);
    });
  });

  it("runs a nested workflow that prunes its snapshots as v2 under a v2 parent, so it doesn't prune", async () => {
    const storage = new MockStore();
    const v1Calls = recordStoreCalls(storage, V1_METHODS);
    const prune = vi.fn(({ snapshot }) => snapshot);
    const inner = createWorkflow({
      id: 'inner',
      inputSchema: z.object({}),
      outputSchema: z.any(),
      options: { pruneSnapshot: prune },
    })
      .then(gateStep())
      .commit();
    const outer = createWorkflow({
      id: 'outer',
      inputSchema: z.object({}),
      outputSchema: z.any(),
      options: { storageVersion: 2 },
    })
      .then(inner)
      .commit();
    new Mastra({ logger: false, storage, workflows: { outer } });

    const run = await outer.createRun();
    expect((await run.start({ inputData: {} })).status).toBe('suspended');
    const resumed = await (
      await outer.createRun({ runId: run.runId })
    ).resume({ step: ['inner', 'gate'], resumeData: true });

    expect(resumed.status).toBe('success');
    expect(prune).not.toHaveBeenCalled();
    expect(v1Calls).toEqual([]);
    const store = storage.stores.workflows!;
    expect(await store.loadWorkflowRunHeader({ workflowName: 'inner', runId: run.runId })).toMatchObject({
      header: { status: 'success' },
    });
  });

  describe('copies the state into a nested run outside a block whose parent has not stored the state it starts from', () => {
    const inner = () =>
      createWorkflow({
        id: 'inner',
        inputSchema: num,
        outputSchema: num,
        stateSchema: items,
        options: { storageVersion: 2 },
      })
        .then(appendItem('inner-add'))
        .commit();
    const cases = {
      'the parent skipped its latest write': {
        build: () =>
          createWorkflow({
            id: 'outer',
            inputSchema: num,
            outputSchema: num,
            stateSchema: items,
            options: {
              storageVersion: 2,
              shouldPersistSnapshot: ({ stepResults }) =>
                stepResults.before?.status !== 'success' || stepResults.inner !== undefined,
            },
          })
            .then(appendItem('before'))
            .then(inner())
            .commit(),
        checkpoints: [['full', 'full']],
        state: [PAD, 'before:0', 'inner-add:1'],
      },
    };

    it.each(Object.entries(cases))('when %s', async (_, { build, checkpoints, state }) => {
      const storage = new MockStore();
      const sends = recordStateSends(storage);
      const outer = build();
      new Mastra({ logger: false, storage, workflows: { outer } });
      const result = await (
        await outer.createRun({ runId: 'run-1' })
      ).start({
        inputData: { n: 0 },
        initialState: { items: [PAD] },
        outputOptions: { includeState: true },
      });
      expect(result.status).toBe('success');
      expect(innerCheckpoints(sends)).toEqual(checkpoints);
      expect(result.state).toEqual({ items: state });
    });
  });

  describe('a nested run inside a parallel, branch or foreach block', () => {
    const withExtra = z.object({ items: z.array(z.string()), extra: z.string().optional() });

    /** Appends `<id>-a`, then `<id>-wait` (suspending first with `suspends`), then `<id>-b`. */
    const appender = (id: string, storageVersion: 1 | 2, { suspends = true } = {}) =>
      createWorkflow({ id, inputSchema: num, outputSchema: num, stateSchema: items, options: { storageVersion } })
        .then(appendItem(`${id}-a`))
        .then(appendItem(`${id}-wait`, { suspends }))
        .then(appendItem(`${id}-b`))
        .commit();

    const outerOf = (storageVersion: 1 | 2) =>
      createWorkflow({
        id: 'outer',
        inputSchema: num,
        outputSchema: z.any(),
        stateSchema: items,
        options: { storageVersion },
      });
    const foreachOuter = (storageVersion: 1 | 2) =>
      createWorkflow({
        id: 'outer',
        inputSchema: z.array(num),
        outputSchema: z.any(),
        stateSchema: items,
        options: { storageVersion },
      });
    /**
     * Adds `extra` to the state, then stores no running write, so the nested run after it starts
     * from a state with a key the parent has not stored. The nested run's state schema drops it.
     */
    const extraOuter = (storageVersion: 1 | 2) =>
      createWorkflow({
        id: 'outer',
        inputSchema: num,
        outputSchema: z.any(),
        stateSchema: withExtra,
        options: {
          storageVersion,
          shouldPersistSnapshot: ({ stepResults, workflowStatus }) =>
            workflowStatus !== 'running' || stepResults['add-extra']?.status !== 'success',
        },
      }).then(
        createStep({
          id: 'add-extra',
          inputSchema: num,
          outputSchema: num,
          stateSchema: withExtra,
          execute: async ({ inputData, state, setState }) => {
            await setState({ ...state, extra: 'x' });
            return inputData;
          },
        }),
      );

    /** Resumes in order, or `first`/`last`: the first or last suspended foreach iteration, until none is left. */
    type Resumes = { step: string | string[] }[] | 'first' | 'last';
    const scenarios: Record<
      string,
      { build: (storageVersion: 1 | 2) => AnyWorkflow; inputData: unknown; resumes: Resumes }
    > = {
      'a foreach over a nested run that does not suspend': {
        build: v =>
          foreachOuter(v)
            .foreach(appender('inner', v, { suspends: false }))
            .commit(),
        inputData: [{ n: 0 }, { n: 10 }, { n: 20 }],
        resumes: [],
      },
      'a foreach, one at a time, over a nested run that suspends': {
        build: v => foreachOuter(v).foreach(appender('inner', v)).commit(),
        inputData: [{ n: 0 }, { n: 10 }, { n: 20 }],
        resumes: 'first',
      },
      'a foreach, two at a time, over a nested run that suspends': {
        build: v => foreachOuter(v).foreach(appender('inner', v), { concurrency: 2 }).commit(),
        inputData: [{ n: 0 }, { n: 10 }, { n: 20 }],
        resumes: 'first',
      },
      'a foreach, three at a time, over a nested run that suspends, resumed last first': {
        build: v => foreachOuter(v).foreach(appender('inner', v), { concurrency: 3 }).commit(),
        inputData: [{ n: 0 }, { n: 10 }, { n: 20 }],
        resumes: 'last',
      },
      'a parallel of two nested runs that suspend, resumed one at a time': {
        build: v =>
          outerOf(v)
            .parallel([appender('inner', v), appender('inner2', v)])
            .commit(),
        inputData: { n: 0 },
        resumes: [{ step: ['inner', 'inner-wait'] }, { step: ['inner2', 'inner2-wait'] }],
      },
      'a parallel of a step and a nested run that suspends': {
        build: v =>
          outerOf(v)
            .parallel([appendItem('plain'), appender('inner', v)])
            .commit(),
        inputData: { n: 0 },
        resumes: [{ step: ['inner', 'inner-wait'] }],
      },
      'a parallel of a step and a nested run that both suspend, the step resumed first': {
        build: v =>
          outerOf(v)
            .parallel([appendItem('plain', { suspends: true }), appender('inner', v)])
            .commit(),
        inputData: { n: 0 },
        resumes: [{ step: 'plain' }, { step: ['inner', 'inner-wait'] }],
      },
      'a branch with two true conditions over nested runs that suspend, resumed last first': {
        build: v =>
          outerOf(v)
            .branch([
              [async () => true, appender('inner', v)],
              [async () => true, appender('inner2', v)],
            ])
            .commit(),
        inputData: { n: 0 },
        resumes: [{ step: ['inner2', 'inner2-wait'] }, { step: ['inner', 'inner-wait'] }],
      },
      'a nested run in a parallel whose state schema drops a key the parent has not stored': {
        build: v =>
          extraOuter(v)
            .parallel([appender('inner', v) as any])
            .commit(),
        inputData: { n: 0 },
        resumes: [{ step: ['inner', 'inner-wait'] }],
      },
      // Outside a block, a nested run keeps building on the parent's stored state while it is paused.
      'a dowhile over a nested run that suspends': {
        build: v =>
          outerOf(v)
            .dowhile(appender('inner', v), async ({ inputData }) => inputData.n < 9)
            .commit(),
        inputData: { n: 0 },
        resumes: [
          { step: ['inner', 'inner-wait'] },
          { step: ['inner', 'inner-wait'] },
          { step: ['inner', 'inner-wait'] },
        ],
      },
      'a nested step whose state schema drops a key the parent has not stored': {
        build: v =>
          extraOuter(v)
            .then(appender('inner', v) as any)
            .commit(),
        inputData: { n: 0 },
        resumes: [{ step: ['inner', 'inner-wait'] }],
      },
    };

    /**
     * Every stored run's status and state, keyed by workflow and foreach index (a foreach iteration's
     * nested run id is random). Finished nested runs are left out: v2 reads one as its parent's
     * current state plus the nested run's changes.
     */
    async function storedByPosition(storage: InstanceType<typeof MockStore>, storageVersion: 1 | 2) {
      const store = storage.stores.workflows!;
      const db = (store as any).db;
      const rows: { workflow_name: string; run_id: string }[] = [
        ...db.workflows.values(),
        ...db.workflowRunHeaders.values(),
      ];
      const states: Record<string, unknown> = {};
      for (const { workflow_name, run_id } of rows) {
        const snapshot = await store.loadWorkflowSnapshot({
          workflowName: workflow_name,
          runId: run_id,
          storageVersion,
        });
        const parent = snapshot?.parentWorkflow;
        if (parent && snapshot.status === 'success') continue;
        const key = parent?.foreachIndex === undefined ? workflow_name : `${workflow_name}[${parent.foreachIndex}]`;
        states[key] = { status: snapshot?.status, state: snapshot?.value };
      }
      return states;
    }

    /** The result and every stored run after the start and after each resume. */
    async function drive(
      storageVersion: 1 | 2,
      { build, inputData, resumes }: (typeof scenarios)[string],
      storage = new MockStore(),
    ) {
      const outer = build(storageVersion);
      new Mastra({ logger: false, storage, workflows: { outer } });
      const run = await outer.createRun({ runId: 'run-1' });
      const outputOptions = { includeState: true };
      let result: any = await run.start({ inputData, initialState: { items: [PAD] }, outputOptions });
      const seen = [
        { status: result.status, state: result.state, stored: await storedByPosition(storage, storageVersion) },
      ];
      const queue = Array.isArray(resumes) ? [...resumes] : [];
      for (let guard = 0; result.status === 'suspended' && guard < 10; guard++) {
        let next: { step: string | string[]; forEachIndex?: number } | undefined = queue.shift();
        if (!Array.isArray(resumes)) {
          const snapshot = await storage.stores.workflows!.loadWorkflowSnapshot({
            workflowName: 'outer',
            runId: 'run-1',
            storageVersion,
          });
          const iterations = (snapshot!.context.inner as any).suspendPayload.__workflow_meta.foreachOutput as any[];
          const suspended = (entry: any) => entry?.status === 'suspended';
          const forEachIndex =
            resumes === 'first' ? iterations.findIndex(suspended) : iterations.findLastIndex(suspended);
          next = { step: ['inner', 'inner-wait'], forEachIndex };
        }
        if (!next) break;
        result = await run.resume({ ...next, resumeData: true, outputOptions });
        seen.push({
          status: result.status,
          state: result.state,
          stored: await storedByPosition(storage, storageVersion),
        });
      }
      expect(result.status).toBe('success');
      return seen;
    }

    it.each(Object.entries(scenarios))('stores the same state as v1: %s', async (_, scenario) => {
      expect(await drive(2, scenario)).toEqual(await drive(1, scenario));
    });

    /** What each nested run's writes sent as state, by the run's status, in write order. */
    async function nestedSends(scenario: string) {
      const storage = new MockStore();
      const sends = recordStateSends(storage);
      await drive(2, scenarios[scenario]!, storage);
      const byRun: Record<string, string[]> = {};
      for (const { workflowName, runId, status, state } of sends) {
        if (workflowName === 'outer') continue;
        (byRun[`${workflowName}/${runId}`] ??= []).push(`${status} ${state}`);
      }
      return Object.values(byRun);
    }

    it("builds on the parent's stored state, and stores its full state once when it pauses", async () => {
      const [inner, inner2] = await nestedSends('a parallel of two nested runs that suspend, resumed one at a time');
      const suspended = ['pending none', 'running none', 'running none', 'running patch', 'running none'];
      const resumed = ['running none', 'running patch', 'running none', 'running patch', 'success none'];
      expect(inner).toEqual([...suspended, 'suspended full', 'suspended none', ...resumed]);
      expect(inner2).toEqual(inner);
    });

    it("builds a foreach iteration on the parent's stored state and the earlier iterations' changes", async () => {
      const runs = await nestedSends('a foreach over a nested run that does not suspend');
      const ran = ['running none', 'running patch', 'running none', 'running patch', 'running none', 'running patch'];
      expect(runs).toEqual([
        ['pending none', 'running none', ...ran, 'success none'],
        ['pending none', 'running patch', ...ran, 'success none'],
        ['pending none', 'running patch', ...ran, 'success none'],
      ]);
    });

    it('stores no full state for a nested step outside a block when it pauses', async () => {
      const [inner] = await nestedSends('a dowhile over a nested run that suspends');
      expect(inner).toContain('suspended none');
      expect(inner!.filter(sent => sent.endsWith('full'))).toEqual([]);
    });
  });

  describe('keeps the parent of a nested run stored while it runs a step', () => {
    const cases = {
      'in a parallel': { branch: false, resumes: false },
      'in a branch': { branch: true, resumes: false },
      'in a parallel, once resumed': { branch: false, resumes: true },
      'in a branch, once resumed': { branch: true, resumes: true },
    };

    it.each(Object.entries(cases))('%s', async (_, { branch, resumes }) => {
      const storedWhileRunning = async (storageVersion: 1 | 2) => {
        const storage = new MockStore();
        let stored: unknown;
        const peek = createStep({
          id: 'peek',
          inputSchema: num,
          outputSchema: num,
          stateSchema: items,
          resumeSchema: z.boolean(),
          execute: async ({ inputData, resumeData, suspend }) => {
            if (resumes && resumeData === undefined) return suspend({});
            const run = await storage.stores.workflows!.loadWorkflowSnapshot({
              workflowName: 'inner',
              runId: 'run-1',
              storageVersion,
            });
            stored = { parentWorkflow: run?.parentWorkflow, state: run?.value };
            return inputData;
          },
        });
        const inner = createWorkflow({
          id: 'inner',
          inputSchema: num,
          outputSchema: z.any(),
          stateSchema: items,
          options: { storageVersion },
        });
        (branch ? inner.branch([[async () => true, peek]]) : inner.parallel([peek])).commit();
        const outer = createWorkflow({
          id: 'outer',
          inputSchema: num,
          outputSchema: z.any(),
          stateSchema: items,
          options: { storageVersion },
        })
          .then(appendItem('before'))
          .then(inner)
          .commit();
        new Mastra({ logger: false, storage, workflows: { outer } });
        const run = await outer.createRun({ runId: 'run-1' });
        let result = await run.start({ inputData: { n: 0 }, initialState: { items: [PAD] } });
        if (resumes) result = await run.resume({ step: ['inner', 'peek'], resumeData: true });
        expect(result.status).toBe('success');
        return stored;
      };

      const v1 = await storedWhileRunning(1);
      expect(v1).toEqual({
        parentWorkflow: expect.objectContaining({ workflowId: 'outer', runId: 'run-1', stepId: 'inner' }),
        state: { items: [PAD, 'before:0'] },
      });
      expect(await storedWhileRunning(2)).toEqual(v1);
    });
  });

  it('resumes a suspended nested run directly with the same state as v1', async () => {
    const resumeDirectly = async (storageVersion: 1 | 2) => {
      const storage = new MockStore();
      const { outer, inner } = suspendingNested(storageVersion);
      new Mastra({ logger: false, storage, workflows: { outer, inner } });
      await (await outer.createRun({ runId: 'run-1' })).start({ inputData: { n: 0 }, initialState: { items: [PAD] } });
      const resumed = await (
        await inner.createRun({ runId: 'run-1' })
      ).resume({
        step: 'inner-wait',
        resumeData: true,
      });
      return { status: resumed.status, stored: await storedStates(storage, storageVersion) };
    };

    const v1 = await resumeDirectly(1);
    expect(v1.status).toBe('success');
    expect(await resumeDirectly(2)).toEqual(v1);
  });

  it('resumes a nested run directly in the version it was stored with after both workflows switch', async () => {
    const suspendThenResume = async (resumeWith: 1 | 2) => {
      const storage = new MockStore();
      const before = suspendingNested(1);
      new Mastra({ logger: false, storage, workflows: before });
      await (
        await before.outer.createRun({ runId: 'run-1' })
      ).start({
        inputData: { n: 0 },
        initialState: { items: [PAD] },
      });

      const after = suspendingNested(resumeWith);
      new Mastra({ logger: false, storage, workflows: after });
      const nested = await after.inner.createRun({ runId: 'run-1' });
      const resumed = await nested.resume({ step: 'inner-wait', resumeData: true });
      return {
        storageVersion: nested.storageVersion,
        status: resumed.status,
        v2Runs: (storage.stores.workflows as any).db.workflowRunHeaders.size,
        stored: await storedStates(storage, 1),
      };
    };

    const unchanged = await suspendThenResume(1);
    expect(unchanged).toMatchObject({ storageVersion: 1, status: 'success', v2Runs: 0 });
    expect(await suspendThenResume(2)).toEqual(unchanged);
  });

  it("reads a finished nested run as its parent's current state plus the nested run's changes", async () => {
    const run = async (storageVersion: 1 | 2) => {
      const storage = new MockStore();
      const inner = createWorkflow({
        id: 'inner',
        inputSchema: num,
        outputSchema: num,
        stateSchema: items,
        options: { storageVersion },
      })
        .then(appendItem('inner-add'))
        .commit();
      const outer = createWorkflow({
        id: 'outer',
        inputSchema: num,
        outputSchema: num,
        stateSchema: items,
        options: { storageVersion },
      })
        .then(appendItem('before'))
        .then(inner)
        .then(appendItem('after'))
        .commit();
      new Mastra({ logger: false, storage, workflows: { outer } });
      await (await outer.createRun({ runId: 'run-1' })).start({ inputData: { n: 0 }, initialState: { items: [PAD] } });
      return storedStates(storage, storageVersion);
    };

    // v1 copies the state into the nested run; v2 stores the nested run's changes on top of the parent's state.
    expect((await run(1))['inner/run-1']).toEqual({
      status: 'success',
      state: { items: [PAD, 'before:0', 'inner-add:1'] },
    });
    expect((await run(2))['inner/run-1']).toEqual({
      status: 'success',
      state: { items: [PAD, 'before:0', 'inner-add:1', 'after:2'] },
    });
  });
});

describe('a re-driven nested step whose nested run already finished', () => {
  /** A foreach over `inner`, which suspends, then appends twice once resumed. */
  const build = (storageVersion: 1 | 2, innerStorageVersion: 1 | 2) => {
    const inner = createWorkflow({
      id: 'inner',
      inputSchema: num,
      outputSchema: num,
      stateSchema: items,
      options: { storageVersion: innerStorageVersion },
    })
      .then(appendItem('inner-wait', { suspends: true }))
      .then(appendItem('inner-b'))
      .commit();
    return createWorkflow({
      id: 'outer',
      inputSchema: z.array(num),
      outputSchema: z.array(num),
      stateSchema: items,
      options: { storageVersion },
    })
      .foreach(inner)
      .commit();
  };

  /** Writes of `outer` after `inner`'s success write never finish, as if the process died there. */
  function dieAfterNestedSuccess(storage: InstanceType<typeof MockStore>) {
    const store = storage.stores.workflows! as unknown as Record<string, (args: any) => Promise<unknown>>;
    let innerDone = false;
    let dying = true;
    let died!: () => void;
    const dead = new Promise<void>(resolve => (died = resolve));
    for (const method of ['persistWorkflowSnapshot', 'writeWorkflowRunCheckpoint', 'appendWorkflowRunEntries']) {
      const write = store[method]!.bind(store);
      store[method] = async args => {
        if (dying && innerDone && args.workflowName === 'outer') {
          died();
          return new Promise(() => {});
        }
        // v1 stores the snapshot object itself; copy it so later in-place edits don't show up stored.
        await write(
          method === 'persistWorkflowSnapshot' ? { ...args, snapshot: structuredClone(args.snapshot) } : args,
        );
        if (args.workflowName === 'inner' && (args.snapshot ?? args.header)?.status === 'success') innerDone = true;
      };
    }
    return dead.then(() => (dying = false));
  }

  it.each([
    [1, 1],
    [2, 2],
    [1, 2],
    [2, 1],
  ] as const)('keeps its state changes on v%s (nested workflow set to v%s)', async (storageVersion, innerVersion) => {
    const storage = new MockStore();
    const dying = build(storageVersion, innerVersion);
    new Mastra({ logger: false, storage, workflows: { outer: dying } });
    const run = await dying.createRun({ runId: 'run-1' });
    expect((await run.start({ inputData: [{ n: 0 }], initialState: { items: [PAD] } })).status).toBe('suspended');
    const dead = dieAfterNestedSuccess(storage);
    void run.resume({ step: ['inner', 'inner-wait'], resumeData: true });
    await dead;

    const outer = build(storageVersion, innerVersion);
    new Mastra({ logger: false, storage, workflows: { outer } });
    const result = await (await outer.createRun({ runId: 'run-1' })).restart({ outputOptions: { includeState: true } });

    expect(result.status).toBe('success');
    const state = { items: [PAD, 'inner-wait:0', 'inner-b:1'] };
    expect(result.state).toEqual(state);
    expect((await storedStates(storage, storageVersion))['outer/run-1']).toEqual({ status: 'success', state });
  });
});

/** Records the step ids of each `loadWorkflowRunSteps` call. */
function recordStepReads(storage: InstanceType<typeof MockStore>) {
  const store = storage.stores.workflows!;
  const reads: string[][] = [];
  const load = store.loadWorkflowRunSteps.bind(store);
  store.loadWorkflowRunSteps = async args => {
    reads.push([...args.stepIds]);
    return load(args);
  };
  return reads;
}

const V1_METHODS = [
  'loadWorkflowSnapshot',
  'getWorkflowRunById',
  'updateWorkflowState',
  'persistWorkflowSnapshot',
] as const;
const V2_METHODS = [
  'loadWorkflowRunHeader',
  'loadWorkflowRun',
  'loadWorkflowRunSteps',
  'updateWorkflowRunHeader',
  'writeWorkflowRunCheckpoint',
  'appendWorkflowRunEntries',
] as const;
type StoreMethod = (typeof V1_METHODS)[number] | (typeof V2_METHODS)[number];

/** Records each call to `methods` as `method`, plus ` v<n>` when it passes a storage version. */
function recordStoreCalls(storage: InstanceType<typeof MockStore>, methods: readonly StoreMethod[]) {
  const store = storage.stores.workflows!;
  const calls: { call: string; workflowName: string; args: any }[] = [];
  for (const method of methods) {
    const original = (store[method] as (args: any) => unknown).bind(store);
    (store as any)[method] = (args: any) => {
      const call = args.storageVersion ? `${method} v${args.storageVersion}` : method;
      calls.push({ call, workflowName: args.workflowName, args });
      return original(args);
    };
  }
  return calls;
}

/** Like `addOne`, but suspends until resumed. */
function approveAddOne(id: string) {
  return createStep({
    id,
    inputSchema: num,
    outputSchema: num,
    stateSchema: marks,
    resumeSchema: z.boolean(),
    execute: async ({ inputData, resumeData, suspend }) => {
      if (resumeData === undefined) return suspend({});
      return { n: inputData.n + 1 };
    },
  });
}

/** A step that returns its input after `onRun`, which can read other steps' results. */
function passThrough(id: string, onRun: (read: (stepId: string) => Promise<any>) => Promise<unknown>) {
  return createStep({
    id,
    inputSchema: z.any(),
    outputSchema: z.any(),
    execute: async ({ inputData, getStepResultAsync }) => {
      await onRun(stepId => getStepResultAsync(stepId));
      return inputData;
    },
  });
}

async function startOn(
  storageVersion: 1 | 2,
  build: (storageVersion: 1 | 2) => AnyWorkflow,
  storage = new MockStore(),
) {
  const workflow = build(storageVersion);
  new Mastra({ logger: false, storage, workflows: { [workflow.id]: workflow } });
  return (await workflow.createRun({ runId: 'run-1' })).start({ inputData: { n: 0 }, initialState: {} });
}

describe('storage v2 memory', () => {
  it('keeps the previous entry, reads older results on demand, and returns every step', async () => {
    let readsInLastStep: string[][] = [];
    let readValues: unknown[] = [];
    let reads: string[][] = [];
    const build = (storageVersion: 1 | 2) => {
      let workflow: any = createWorkflow({
        id: 'chain',
        inputSchema: num,
        outputSchema: z.any(),
        options: { storageVersion },
      });
      for (let i = 1; i < 10; i++) workflow = workflow.then(addOne(`step${i}`));
      return workflow
        .then(
          passThrough('step10', async read => {
            const before = reads.length;
            readValues = [await read('step1'), await read('step9')];
            readsInLastStep = reads.slice(before);
          }),
        )
        .commit();
    };

    const v1 = await startOn(1, build);
    expect(readValues).toEqual([{ n: 1 }, { n: 9 }]);

    const storage = new MockStore();
    reads = recordStepReads(storage);
    const v2 = await startOn(2, build, storage);
    expect(readValues).toEqual([{ n: 1 }, { n: 9 }]);
    // step9 is the previous entry, so it's in memory; step1 was evicted.
    expect(readsInLastStep).toEqual([['step1']]);
    // No step read its input from storage, since each one's previous entry was still in memory.
    // The end of the run reads back what is still evicted, in one read.
    expect(reads).toEqual([['step1'], ['step2', 'step3', 'step4', 'step5', 'step6', 'step7', 'step8']]);
    expect(withoutTimestamps(v2)).toEqual(withoutTimestamps(v1));
  });

  it('keeps a parallel entry for the entry after it, then evicts it', async () => {
    const storage = new MockStore();
    const reads = recordStepReads(storage);
    let afterReads: string[][] = [];
    let joined: unknown;
    const result = await startOn(
      2,
      storageVersion =>
        createWorkflow({ id: 'join', inputSchema: num, outputSchema: z.any(), options: { storageVersion } })
          .parallel([addOne('left'), addOne('right')])
          .then(
            passThrough('join', async read => {
              await read('left');
            }),
          )
          .then(
            passThrough('after', async read => {
              const before = reads.length;
              joined = await read('join');
              await read('left');
              afterReads = reads.slice(before);
            }),
          )
          .then(passThrough('last', async () => {}))
          .commit(),
      storage,
    );

    expect(result.status).toBe('success');
    expect(joined).toEqual({ left: { n: 1 }, right: { n: 1 } });
    // left was evicted when join ended, so after reads it from storage.
    expect(afterReads).toEqual([['left']]);
    // join and after find their input in memory, and join finds left there too. The only other
    // read is the end of the run reading back what is still evicted.
    expect(reads).toEqual([['left'], ['left', 'right', 'join']]);
  });

  it('reads an evicted step once across foreach iterations', async () => {
    const storage = new MockStore();
    const reads = recordStepReads(storage);
    const iterationReads: string[][] = [];
    const result = await startOn(
      2,
      storageVersion =>
        createWorkflow({ id: 'each', inputSchema: num, outputSchema: z.any(), options: { storageVersion } })
          .then(addOne('seed'))
          .map(async () => Array.from({ length: 20 }, (_, k) => ({ n: k })))
          .foreach(
            createStep({
              id: 'plus-seed',
              inputSchema: num,
              outputSchema: num,
              execute: async ({ inputData, getStepResultAsync }) => {
                const before = reads.length;
                const seed = (await getStepResultAsync('seed')) as { n: number };
                iterationReads.push(...reads.slice(before));
                return { n: inputData.n + seed.n };
              },
            }),
          )
          .commit(),
      storage,
    );

    expect(result.status === 'success' && result.result).toEqual(Array.from({ length: 20 }, (_, k) => ({ n: k + 1 })));
    // seed was evicted when the map ended. The first iteration reads it; the rest find it in memory.
    expect(iterationReads).toEqual([['seed']]);
  });

  it('resolves a declarative map of an evicted step through storage', async () => {
    const storage = new MockStore();
    const reads = recordStepReads(storage);
    const first = addOne('first');
    const result = await startOn(
      2,
      storageVersion =>
        createWorkflow({ id: 'mapped', inputSchema: num, outputSchema: z.any(), options: { storageVersion } })
          .then(first)
          .then(addOne('second'))
          .then(addOne('third'))
          .map({ fromFirst: { step: first, path: 'n' } })
          .commit(),
      storage,
    );

    expect(result.status === 'success' && result.result).toEqual({ fromFirst: 1 });
    // first is two entries behind the map, so the map had to read it from storage.
    expect(reads).toContainEqual(['first']);
  });

  it("doesn't evict results that a shouldPersistSnapshot predicate kept out of storage", async () => {
    let readValue: unknown;
    const build = (storageVersion: 1 | 2) =>
      createWorkflow({
        id: 'unpersisted',
        inputSchema: num,
        outputSchema: z.any(),
        options: { storageVersion, shouldPersistSnapshot: ({ workflowStatus }) => workflowStatus !== 'running' },
      })
        .then(addOne('a'))
        .then(addOne('b'))
        .then(addOne('c'))
        .then(
          passThrough('d', async read => {
            readValue = await read('a');
          }),
        )
        .commit();

    const v1 = await startOn(1, build);
    const storage = new MockStore();
    const reads = recordStepReads(storage);
    const v2 = await startOn(2, build, storage);

    expect(readValue).toEqual({ n: 1 });
    expect(reads).toEqual([]);
    expect(withoutTimestamps(v2)).toEqual(withoutTimestamps(v1));
  });

  it.each([
    [2, 2],
    [1, 2],
    [2, 1],
  ] as const)(
    "reads and writes a nested workflow in its parent run's storage version (parent v%i, child v%i)",
    async (parentVersion, childVersion) => {
      const storage = new MockStore();
      const calls = recordStoreCalls(storage, parentVersion === 2 ? V1_METHODS : V2_METHODS);
      const inner = createWorkflow({
        id: 'inner',
        inputSchema: z.object({}),
        outputSchema: z.any(),
        options: { storageVersion: childVersion },
      })
        .then(gateStep())
        .commit();
      const outer = createWorkflow({
        id: 'outer',
        inputSchema: z.object({}),
        outputSchema: z.any(),
        options: { storageVersion: parentVersion },
      })
        .then(inner)
        .commit();
      new Mastra({ logger: false, storage, workflows: { outer } });

      const run = await outer.createRun();
      expect((await run.start({ inputData: {} })).status).toBe('suspended');

      const result = await (
        await outer.createRun({ runId: run.runId })
      ).resume({
        step: ['inner', 'gate'],
        resumeData: true,
      });

      expect(result.status).toBe('success');
      // The nested run reuses the parent's runId, but it is never stored in the other version's
      // table, so it doesn't probe that one either.
      expect(calls.filter(c => c.workflowName === 'inner').map(c => c.call)).toEqual([]);
    },
  );

  it('resumes a parallel entry with one summary read of the run and one read of the steps it needs', async () => {
    const build = (storageVersion: 1 | 2) =>
      createWorkflow({ id: 'fork', inputSchema: num, outputSchema: z.any(), options: { storageVersion } })
        .then(addOne('a'))
        .parallel([addOne('done'), approveAddOne('gate')])
        .commit();
    const startThenResume = async (
      storageVersion: 1 | 2,
      storage: InstanceType<typeof MockStore>,
      onSuspended = () => {},
    ) => {
      const workflow = build(storageVersion);
      new Mastra({ logger: false, storage, workflows: { fork: workflow } });
      const run = await workflow.createRun({ runId: 'run-1' });
      expect((await run.start({ inputData: { n: 0 } })).status).toBe('suspended');
      onSuspended();
      return (await workflow.createRun({ runId: 'run-1' })).resume({ step: 'gate', resumeData: true });
    };

    const v1 = await startThenResume(1, new MockStore());
    const storage = new MockStore();
    let calls: ReturnType<typeof recordStoreCalls> = [];
    const v2 = await startThenResume(2, storage, () => {
      calls = recordStoreCalls(storage, [...V1_METHODS, 'loadWorkflowRun', 'loadWorkflowRunSteps']);
    });

    expect(v2.status).toBe('success');
    expect(
      calls.map(c => (c.call === 'loadWorkflowRun' ? `loadWorkflowRun ${c.args.successfulSteps}` : c.call)),
    ).toEqual(['loadWorkflowRun summary', 'loadWorkflowRunSteps']);
    // The finished sibling and the previous entry, read before the entry runs.
    expect([...calls[1]!.args.stepIds].sort()).toEqual(['a', 'done']);
    expect(withoutTimestamps(v2)).toEqual(withoutTimestamps(v1));
  });

  it('gives a concurrent resume WORKFLOW_RESUME_ALREADY_CLAIMED', async () => {
    let releaseDownstream!: () => void;
    const downstreamReleased = new Promise<void>(resolve => (releaseDownstream = resolve));
    let downstreamRuns = 0;
    const workflow = createWorkflow({
      id: 'gated',
      inputSchema: z.object({}),
      outputSchema: z.any(),
      options: { storageVersion: 2 },
    })
      .then(gateStep())
      .then(
        createStep({
          id: 'downstream',
          inputSchema: z.any(),
          outputSchema: z.any(),
          execute: async () => {
            downstreamRuns++;
            await downstreamReleased;
            return {};
          },
        }),
      )
      .commit();
    const storage = new MockStore();
    new Mastra({ logger: false, storage, workflows: { gated: workflow } });
    const run = await workflow.createRun();
    expect((await run.start({ inputData: {} })).status).toBe('suspended');

    const settled = Promise.allSettled([
      run.resume({ step: 'gate', resumeData: true }),
      run.resume({ step: 'gate', resumeData: true }),
    ]);
    await vi.waitFor(() => expect(downstreamRuns).toBe(1));
    releaseDownstream();
    const results = await settled;

    expect(results.map(r => r.status).sort()).toEqual(['fulfilled', 'rejected']);
    expect((results.find(r => r.status === 'rejected') as PromiseRejectedResult).reason.id).toBe(
      'WORKFLOW_RESUME_ALREADY_CLAIMED',
    );
    expect(downstreamRuns).toBe(1);
  });

  it('releases the claim of a failed resume only while no entry was written since the claim', async () => {
    const storage = new MockStore();
    const workflow = gateWorkflow(2);
    host(storage, workflow);
    const run = await workflow.createRun();
    expect((await run.start({ inputData: {} })).status).toBe('suspended');
    const store = storage.stores.workflows!;
    const status = async () =>
      (await store.loadWorkflowRunHeader({ workflowName: 'gated', runId: run.runId }))?.header.status;
    const execute = vi.spyOn((run as any).executionEngine, 'execute');

    execute.mockRejectedValueOnce(new Error('engine boom'));
    await expect(run.resume({ step: 'gate', resumeData: true })).rejects.toThrow('engine boom');
    expect(await status()).toBe('suspended');

    // An entry written under the claim keeps it, even when the header still looks as claimed:
    // only `lastSeq` shows the write.
    execute.mockImplementationOnce(async () => {
      const current = (await store.loadWorkflowRunHeader({ workflowName: 'gated', runId: run.runId }))!;
      await store.appendWorkflowRunEntries({
        workflowName: 'gated',
        runId: run.runId,
        header: current.header,
        steps: { gate: { status: 'success', output: { approved: true }, payload: {}, startedAt: 1, endedAt: 2 } },
      });
      throw new Error('engine boom');
    });
    await expect(run.resume({ step: 'gate', resumeData: true })).rejects.toThrow('engine boom');
    expect(await status()).toBe('running');
  });

  it('releases a v2 parent whose resume fails before writing, after a nested child claimed it', async () => {
    const storage = new MockStore();
    const inner = createWorkflow({
      id: 'inner',
      inputSchema: z.object({}),
      outputSchema: z.any(),
      options: { storageVersion: 2 },
    })
      .then(gateStep())
      .commit();
    const outer = createWorkflow({
      id: 'outer',
      inputSchema: z.object({}),
      outputSchema: z.any(),
      options: { storageVersion: 2 },
    })
      .then(inner)
      .commit();
    new Mastra({ logger: false, storage, workflows: { outer } });
    const run = await outer.createRun();
    expect((await run.start({ inputData: {} })).status).toBe('suspended');

    const store = storage.stores.workflows!;
    const parentHeader = () => store.loadWorkflowRunHeader({ workflowName: 'outer', runId: run.runId });
    const lastSeqBefore = (await parentHeader())!.lastSeq;
    const calls = recordStoreCalls(storage, [...V1_METHODS, 'loadWorkflowRun']);
    const parentExecute = vi
      .spyOn((run as any).executionEngine, 'execute')
      .mockRejectedValueOnce(new Error('parent boom'));

    const child = await inner.createRun({ runId: run.runId });
    expect((await child.resume({ step: 'gate', resumeData: true })).status).toBe('success');

    // The child claims the parent and hands the claimed snapshot to the parent's resume, whose
    // own RunStorage must find the `lastSeq` the claim loaded it at.
    await vi.waitFor(() => expect(parentExecute).toHaveBeenCalledTimes(1));
    await vi.waitFor(async () => expect((await parentHeader())?.header.status).toBe('suspended'));
    expect((await parentHeader())?.lastSeq).toBe(lastSeqBefore);
    // The claim loads the parent the way the parent's resume would.
    expect(
      calls
        .filter(c => c.workflowName === 'outer')
        .map(c => (c.call === 'loadWorkflowRun' ? `loadWorkflowRun ${c.args.successfulSteps}` : c.call)),
    ).toEqual(['loadWorkflowRun summary']);
  });

  it('cancels a suspended run with one header read and one header update', async () => {
    const storage = new MockStore();
    const workflow = gateWorkflow(2);
    host(storage, workflow);
    const run = await workflow.createRun();
    expect((await run.start({ inputData: {} })).status).toBe('suspended');

    const calls = recordStoreCalls(storage, [...V1_METHODS, ...V2_METHODS]);
    await run.cancel();

    expect(calls.map(c => c.call)).toEqual(['loadWorkflowRunHeader', 'updateWorkflowRunHeader']);
    expect(calls[1]!.args.opts).toEqual({ status: 'canceled' });
    const stored = await storage.stores.workflows!.loadWorkflowRunHeader({ workflowName: 'gated', runId: run.runId });
    expect(stored?.header.status).toBe('canceled');
  });

  it('creates runs with one header read, probing v1 only for a caller-given id it has not stored', async () => {
    const storage = new MockStore();
    const workflow = gateWorkflow(2);
    host(storage, workflow);
    const calls = recordStoreCalls(storage, [...V1_METHODS, 'loadWorkflowRunHeader', 'loadWorkflowRun']);
    const createRunCalls = async (options?: { runId: string }) => {
      calls.length = 0;
      const run = await workflow.createRun(options);
      return { run, calls: calls.map(c => c.call) };
    };

    const fresh = await createRunCalls();
    expect(fresh.calls).toEqual(['loadWorkflowRunHeader']);
    expect((await createRunCalls({ runId: fresh.run.runId })).calls).toEqual(['loadWorkflowRunHeader']);
    expect((await createRunCalls({ runId: 'unstored' })).calls).toEqual([
      'loadWorkflowRunHeader',
      'loadWorkflowSnapshot v1',
    ]);
  });
});
