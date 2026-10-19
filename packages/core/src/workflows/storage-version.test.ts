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

  it('fails a storageVersion: 2 workflow nested in an evented parent instead of storing it as v1', async () => {
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

      expect(result.status).toBe('failed');
      expect((result as any).error.code).toBe('WORKFLOW_STORAGE_V2_UNSUPPORTED_ENGINE');
      expect((result as any).steps['nested-v2'].status).toBe('failed');
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

  it('refuses to continue a v1 run through a v2 definition and leaves it untouched', async () => {
    const storage = new MockStore();
    const v1 = gateWorkflow(1);
    host(storage, v1);
    const run = await v1.createRun();
    expect((await run.start({ inputData: {} })).status).toBe('suspended');

    const store = (await storage.getStore('workflows'))!;
    const before = structuredClone(await store.loadWorkflowSnapshot({ workflowName: 'gated', runId: run.runId }));

    const v2 = gateWorkflow(2);
    host(storage, v2);
    await expect(v2.createRun({ runId: run.runId })).rejects.toThrow(
      /was created with storageVersion: 1, but the workflow now sets storageVersion: 2/,
    );

    expect(await store.loadWorkflowSnapshot({ workflowName: 'gated', runId: run.runId, storageVersion: 2 })).toBeNull();
    expect(await store.loadWorkflowSnapshot({ workflowName: 'gated', runId: run.runId })).toEqual(before);

    // The rejected run isn't cached, so the original definition can still resume it.
    const resumed = await (await v1.createRun({ runId: run.runId })).resume({ step: 'gate', resumeData: true });
    expect(resumed.status).toBe('success');
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

  it('refuses to continue a v2 run through a v1 definition', async () => {
    const storage = new MockStore();
    const v2 = gateWorkflow(2);
    host(storage, v2);
    const run = await v2.createRun();

    const v1 = gateWorkflow(1);
    host(storage, v1);
    await expect(v1.createRun({ runId: run.runId })).rejects.toThrow(
      /was created with storageVersion: 2, but the workflow now sets storageVersion: 1/,
    );

    const store = (await storage.getStore('workflows'))!;
    expect(await store.loadWorkflowSnapshot({ workflowName: 'gated', runId: run.runId, storageVersion: 1 })).toBeNull();
  });
});

const num = z.object({ n: z.number() });
const marks = z.object({ marked: z.number().optional() });

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
      changes: { stepIds: Object.keys(args.steps), state: args.state !== undefined },
    });
    return append(args);
  };
  const entries = (workflowName: string, runId: string): { kind: string; stepId?: string }[] =>
    (store as any).db.workflowRunEntries.get(`${workflowName}-${runId}`);
  return { writes, entries };
}

describe('storage v2 write volume', () => {
  const STEPS = 20;

  it('appends only the changed step per write, and state only after setState', async () => {
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
    expect(appends.filter(w => w.changes!.state)).toEqual([
      { status: 'running', changes: { stepIds: ['s10'], state: true } },
      { status: 'success', changes: { stepIds: [], state: true } },
    ]);

    // One entry per step start and finish, plus the input, plus state at the checkpoint, after setState, and at the end.
    const stored = entries('sequential', run.runId);
    expect(stored.filter(e => e.kind === 'step')).toHaveLength(2 * STEPS + 1);
    expect(stored.filter(e => e.kind === 'state')).toHaveLength(3);
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

    // The checkpoint holds the input and the state; then one entry per append above, and the state at the end.
    const stored = entries('loop', run.runId);
    expect(stored.filter(e => e.kind === 'step')).toHaveLength(STEPS + 2);
    expect(stored.filter(e => e.kind === 'state')).toHaveLength(2);
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
  'suspend and resume': {
    build: storageVersion => gateWorkflow(storageVersion),
    drive: async (workflow, runId) => {
      await (await workflow.createRun({ runId })).start({ inputData: {} });
      return (await workflow.createRun({ runId })).resume({ step: 'gate', resumeData: true });
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
    'reads and writes a nested workflow by its own storage version (parent v%i, child v%i)',
    async (parentVersion, childVersion) => {
      const storage = new MockStore();
      const calls = recordStoreCalls(storage, childVersion === 2 ? V1_METHODS : V2_METHODS);
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
      // A nested run reuses the parent's runId, so its first createRun probes v1 for the
      // version-mismatch error. That probe is the only other-version call.
      expect(calls.filter(c => c.workflowName === 'inner').map(c => c.call)).toEqual(
        childVersion === 2 ? ['loadWorkflowSnapshot v1'] : [],
      );
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
