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
  const persist = store.persistWorkflowSnapshot.bind(store);
  store.persistWorkflowSnapshot = async args => {
    if (args.storageVersion === 2) writes.push({ status: args.snapshot.status, changes: args.changes });
    return persist(args);
  };
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

    // createRun's pending write and the first running write are checkpoints; every later write is an append.
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

    const appends = writes.filter(w => w.changes);
    expect(appends.filter(w => w.status === 'running').map(w => w.changes)).toEqual(
      Array.from({ length: STEPS }, () => ({ stepIds: ['count'], state: false })),
    );

    // The checkpoint holds the input, the first iteration's running result and the state;
    // then one entry per iteration, and the state at the end.
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
