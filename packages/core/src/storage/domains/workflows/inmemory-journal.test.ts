import { describe, expect, it } from 'vitest';
import type { WorkflowRunState } from '../../../workflows';
import { RunFenceConflictError } from '../../run-fencing';
import { InMemoryDB } from '../inmemory-db';
import { WorkflowsStorage } from './base';
import { WorkflowsInMemory } from './inmemory';
import { materializeWorkflowRun, summarizeStepResult } from './journal';
import type { WorkflowRunHeader } from './journal';

// `WorkflowRunState.value` is typed as string-valued, but holds any workflow state.
const makeSnapshot = (runId: string, overrides: Record<string, any> = {}): WorkflowRunState =>
  ({
    runId,
    status: 'running',
    value: {},
    context: {},
    activePaths: [],
    activeStepsPath: {},
    suspendedPaths: {},
    resumeLabels: {},
    serializedStepGraph: [],
    waitingPaths: {},
    timestamp: 1,
    ...overrides,
  }) as WorkflowRunState;

const ok = (output: unknown) => ({ status: 'success', output, payload: {}, startedAt: 1, endedAt: 2 }) as any;

function setup() {
  const db = new InMemoryDB();
  return { db, store: new WorkflowsInMemory({ db }) };
}

const makeHeader = (runId: string, overrides: Record<string, any> = {}): WorkflowRunHeader => {
  const { context: _context, value: _value, ...header } = makeSnapshot(runId, overrides);
  return header;
};

describe('WorkflowsInMemory v1 methods on storage v2 runs', () => {
  const run = { workflowName: 'wf', runId: 'r1' };

  it('supports run journals', () => {
    expect(setup().store.supportsRunJournal()).toBe(true);
  });

  it('loads a v2 run as a whole snapshot, as copies', async () => {
    const { store } = setup();
    await store.writeWorkflowRunCheckpoint({
      ...run,
      header: makeHeader('r1'),
      steps: { input: {} as any, a: ok({ list: [1] }), b: ok(2) },
      state: { n: 1 },
    });

    const loaded = await store.loadWorkflowSnapshot(run);
    expect(loaded).toEqual(
      makeSnapshot('r1', { context: { input: {}, a: ok({ list: [1] }), b: ok(2) }, value: { n: 1 } }),
    );

    (loaded!.context.a as any).output.list.push(2);
    expect((await store.loadWorkflowSnapshot(run))!.context.a).toMatchObject({ output: { list: [1] } });
  });

  it('patches the header with compare-and-set, and returns the rebuilt state', async () => {
    const { store } = setup();
    await store.writeWorkflowRunCheckpoint({ ...run, header: makeHeader('r1'), steps: { a: ok(1) }, state: { n: 1 } });

    const skipped = await store.updateWorkflowState({
      ...run,
      opts: { status: 'canceled', expectedStatus: 'suspended' },
    });
    expect(skipped).toBeUndefined();
    expect((await store.loadWorkflowSnapshot(run))!.status).toBe('running');

    const updated = await store.updateWorkflowState({
      ...run,
      opts: { status: 'canceled', expectedStatus: 'running' },
    });
    expect(updated).toMatchObject({ status: 'canceled', context: { a: ok(1) }, value: { n: 1 } });
    expect((await store.loadWorkflowSnapshot(run))!.status).toBe('canceled');

    // A version hint limits the patch to that store.
    expect(await store.updateWorkflowState({ ...run, opts: { status: 'success' }, storageVersion: 1 })).toBeUndefined();
    expect((await store.loadWorkflowSnapshot(run))!.status).toBe('canceled');
  });

  it('rejects updateWorkflowResults on v2 runs', async () => {
    const { store } = setup();
    await store.writeWorkflowRunCheckpoint({ ...run, header: makeHeader('r1'), steps: {}, state: {} });

    await expect(
      store.updateWorkflowResults({ ...run, stepId: 'a', result: ok(1), requestContext: {} }),
    ).rejects.toThrow(/storage v2/);
    // Unknown runs still return an empty object.
    expect(
      await store.updateWorkflowResults({
        workflowName: 'wf',
        runId: 'nope',
        stepId: 'a',
        result: ok(1),
        requestContext: {},
      }),
    ).toEqual({});
  });

  it('reads, lists and deletes runs across both stores', async () => {
    const { store } = setup();
    await store.persistWorkflowSnapshot({
      workflowName: 'wf',
      runId: 'v1-run',
      resourceId: 'res',
      snapshot: makeSnapshot('v1-run', { status: 'success' }),
      createdAt: new Date(1000),
    });
    await store.writeWorkflowRunCheckpoint({
      workflowName: 'wf',
      runId: 'v2-run',
      resourceId: 'res',
      header: makeHeader('v2-run', { status: 'suspended' }),
      steps: { a: ok(1) },
      state: {},
    });
    await store.writeWorkflowRunCheckpoint({
      workflowName: 'other',
      runId: 'v2-other',
      header: makeHeader('v2-other'),
      steps: {},
      state: {},
    });

    // Loads without a hint find either version; a hint limits the lookup.
    expect(await store.loadWorkflowSnapshot({ workflowName: 'wf', runId: 'v1-run' })).toMatchObject({
      status: 'success',
    });
    expect(await store.loadWorkflowSnapshot({ workflowName: 'wf', runId: 'v2-run' })).toMatchObject({
      status: 'suspended',
      context: { a: ok(1) },
    });
    expect(await store.loadWorkflowSnapshot({ workflowName: 'wf', runId: 'v2-run', storageVersion: 1 })).toBeNull();
    expect(await store.loadWorkflowSnapshot({ workflowName: 'wf', runId: 'v1-run', storageVersion: 2 })).toBeNull();

    const v2 = await store.getWorkflowRunById({ runId: 'v2-run', workflowName: 'wf' });
    expect(v2).toMatchObject({ runId: 'v2-run', workflowName: 'wf', resourceId: 'res', storageVersion: 2 });
    expect(v2!.snapshot).toMatchObject({ context: { a: ok(1) } });
    const v1 = await store.getWorkflowRunById({ runId: 'v1-run' });
    expect(v1).toMatchObject({ runId: 'v1-run', workflowName: 'wf' });
    expect(v1).not.toHaveProperty('storageVersion');
    expect(await store.getWorkflowRunById({ runId: 'v2-run', storageVersion: 1 })).toBeNull();

    const all = await store.listWorkflowRuns();
    expect(all.total).toBe(3);
    const byResource = await store.listWorkflowRuns({ resourceId: 'res' });
    expect(byResource.runs.map(r => r.runId)).toEqual(['v2-run', 'v1-run']);
    expect((await store.listWorkflowRuns({ workflowName: 'wf', status: 'suspended' })).runs.map(r => r.runId)).toEqual([
      'v2-run',
    ]);
    expect((await store.listWorkflowRuns({ workflowName: 'other' })).runs[0]).toMatchObject({ storageVersion: 2 });

    await store.deleteWorkflowRunById({ workflowName: 'wf', runId: 'v2-run' });
    await store.deleteWorkflowRunById({ workflowName: 'wf', runId: 'v1-run' });
    expect(await store.getWorkflowRunById({ runId: 'v2-run' })).toBeNull();
    expect(await store.getWorkflowRunById({ runId: 'v1-run' })).toBeNull();

    await store.dangerouslyClearAll();
    expect((await store.listWorkflowRuns()).total).toBe(0);
  });
});

describe('WorkflowsInMemory storage v2 methods', () => {
  const run = { workflowName: 'wf', runId: 'r1' };

  it('writes a checkpoint as one entry per step in order, then the state, outside the v1 store', async () => {
    const { db, store } = setup();
    await store.writeWorkflowRunCheckpoint({
      ...run,
      header: makeHeader('r1'),
      steps: { input: { x: 1 } as any, a: ok(1), b: ok(2) },
      state: { n: 1 },
    });

    expect(db.workflows.size).toBe(0);
    expect(db.workflowRunEntries.get('wf-r1')!.map(e => [e.seq, e.kind === 'step' ? e.stepId : 'state'])).toEqual([
      [1, 'input'],
      [2, 'a'],
      [3, 'b'],
      [4, 'state'],
    ]);
    expect(await store.loadWorkflowRun({ ...run, successfulSteps: 'full' })).toEqual({
      header: makeHeader('r1'),
      lastSeq: 4,
      startStateSeq: 4,
      state: { n: 1 },
      statePatchBytes: 0,
      steps: { input: { x: 1 }, a: ok(1), b: ok(2) },
      summarizedStepIds: [],
    });
    // Generic readers still see the run.
    expect(await store.loadWorkflowSnapshot(run)).toEqual(
      makeSnapshot('r1', { context: { input: { x: 1 }, a: ok(1), b: ok(2) }, value: { n: 1 } }),
    );
  });

  it('appends the given steps, and the state only when given', async () => {
    const { db, store } = setup();
    await store.writeWorkflowRunCheckpoint({
      ...run,
      header: makeHeader('r1'),
      steps: { a: ok(1), b: ok(2) },
      state: { n: 1 },
    });

    await store.appendWorkflowRunEntries({ ...run, header: makeHeader('r1'), steps: { c: ok(3) } });
    let loaded = await store.loadWorkflowRun({ ...run, successfulSteps: 'full' });
    expect(loaded!.state).toEqual({ n: 1 });
    expect(loaded!.lastSeq).toBe(4);

    await store.appendWorkflowRunEntries({
      ...run,
      header: makeHeader('r1', { status: 'success' }),
      steps: { a: ok(10) },
      state: { n: 2 },
    });
    loaded = await store.loadWorkflowRun({ ...run, successfulSteps: 'full' });
    expect(loaded!.header.status).toBe('success');
    expect(loaded!.state).toEqual({ n: 2 });
    expect(loaded!.lastSeq).toBe(6);
    // The latest entry per step, kept where each step was first written.
    expect(Object.entries(loaded!.steps)).toEqual([
      ['a', ok(10)],
      ['b', ok(2)],
      ['c', ok(3)],
    ]);
    expect(db.workflowRunEntries.get('wf-r1')!.map(e => e.seq)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('replaces all entries on a later checkpoint, keeping seq increasing', async () => {
    const { db, store } = setup();
    await store.writeWorkflowRunCheckpoint({ ...run, header: makeHeader('r1'), steps: { a: ok(1) }, state: {} });
    await store.writeWorkflowRunCheckpoint({ ...run, header: makeHeader('r1'), steps: { b: ok(2) }, state: { n: 2 } });

    expect(db.workflowRunEntries.get('wf-r1')!.map(e => e.seq)).toEqual([3, 4]);
    expect(await store.loadWorkflowRun({ ...run, successfulSteps: 'full' })).toMatchObject({
      lastSeq: 4,
      steps: { b: ok(2) },
      state: { n: 2 },
    });
  });

  it("keeps the earlier state entries on a checkpoint once another run's state builds on the run's", async () => {
    const { db, store } = setup();
    await store.writeWorkflowRunCheckpoint({ ...run, header: makeHeader('r1'), steps: { a: ok(1) }, state: { n: 1 } });
    await store.writeWorkflowRunCheckpoint({
      workflowName: 'child',
      runId: 'r1',
      header: makeHeader('r1'),
      steps: {},
      stateBase: { ...run, seq: 2 },
    });
    await store.writeWorkflowRunCheckpoint({ ...run, header: makeHeader('r1'), steps: { b: ok(2) }, state: { n: 2 } });

    expect(db.workflowRunEntries.get('wf-r1')!.map(e => [e.seq, e.kind])).toEqual([
      [2, 'state'],
      [3, 'step'],
      [4, 'state'],
    ]);
    expect((await store.loadWorkflowRun({ ...run, successfulSteps: 'full' }))!.state).toEqual({ n: 2 });
    const child = await store.loadWorkflowRun({ workflowName: 'child', runId: 'r1', successfulSteps: 'full' });
    expect(child!.state).toEqual({ n: 1 });

    // A draft shares the run's state too.
    const other = { workflowName: 'other', runId: 'r1', header: makeHeader('r1'), steps: {}, state: {} };
    await store.writeWorkflowRunCheckpoint(other);
    await store.appendWorkflowRunStateDraft({ ...other, state: { d: 1 } });
    await store.writeWorkflowRunCheckpoint(other);
    expect(db.workflowRunEntries.get('other-r1')!.map(e => e.kind)).toEqual(['state', 'state-draft', 'state']);
  });

  it('returns the last seq of each write', async () => {
    const { store } = setup();
    expect(
      await store.writeWorkflowRunCheckpoint({ ...run, header: makeHeader('r1'), steps: { a: ok(1) }, state: {} }),
    ).toEqual({ lastSeq: 2 });
    expect(
      await store.appendWorkflowRunEntries({ ...run, header: makeHeader('r1'), steps: { b: ok(2) }, state: { n: 1 } }),
    ).toEqual({ lastSeq: 4 });
    expect(await store.appendWorkflowRunEntries({ ...run, header: makeHeader('r1'), steps: {} })).toEqual({
      lastSeq: 4,
    });
  });

  it("records the drive's start state seq, and loads the state as of a seq", async () => {
    const { store } = setup();
    await store.writeWorkflowRunCheckpoint({ ...run, header: makeHeader('r1'), steps: { a: ok(1) }, state: { n: 1 } });
    await store.appendWorkflowRunEntries({ ...run, header: makeHeader('r1'), steps: {}, state: { n: 2 } });
    // Plain appends keep the checkpoint's start state.
    expect((await store.loadWorkflowRunHeader(run))!.startStateSeq).toBe(2);
    // A resumed drive's first append moves it to the version the resume started from.
    await store.appendWorkflowRunEntries({
      ...run,
      header: makeHeader('r1'),
      steps: {},
      statePatch: [{ op: 'set', path: ['n'], value: 4 }],
      startStateSeq: 3,
    });
    expect((await store.loadWorkflowRunHeader(run))!.startStateSeq).toBe(3);

    expect(await store.loadWorkflowRunState({ ...run, seq: 2 })).toEqual({ n: 1 });
    expect(await store.loadWorkflowRunState({ ...run, seq: 3 })).toEqual({ n: 2 });
    expect(await store.loadWorkflowRunState({ ...run, seq: 4 })).toEqual({ n: 4 });
    expect(await store.loadWorkflowRunState({ workflowName: 'wf', runId: 'nope', seq: 1 })).toBeNull();

    // A later checkpoint starts a new drive.
    await store.writeWorkflowRunCheckpoint({ ...run, header: makeHeader('r1'), steps: {}, state: { n: 5 } });
    expect((await store.loadWorkflowRunHeader(run))!.startStateSeq).toBe(5);
  });

  it('creates the run when appending to one that is not stored', async () => {
    const { store } = setup();
    await store.appendWorkflowRunEntries({ ...run, resourceId: 'res', header: makeHeader('r1'), steps: { a: ok(1) } });

    expect(await store.loadWorkflowRun({ ...run, successfulSteps: 'full' })).toEqual({
      header: makeHeader('r1'),
      lastSeq: 1,
      startStateSeq: 0,
      state: {},
      statePatchBytes: 0,
      steps: { a: ok(1) },
      summarizedStepIds: [],
    });
    expect((await store.getWorkflowRunById({ runId: 'r1' }))!.resourceId).toBe('res');
  });

  it('summarizes successful steps only, keeping input and every other result in full', async () => {
    const { store } = setup();
    const succeeded = {
      ...ok({ big: 'x' }),
      resumePayload: { r: 1 },
      suspendPayload: { s: 1 },
      suspendOutput: { o: 1 },
      suspendedAt: 3,
      resumedAt: 4,
      metadata: { iterationCount: 2 },
    };
    const suspended = { status: 'suspended', payload: { p: 1 }, suspendPayload: { s: 1 }, startedAt: 1 };
    const failed = { status: 'failed', payload: { p: 1 }, error: 'boom', startedAt: 1, endedAt: 2 };
    const running = { status: 'running', payload: { p: 1 }, resumePayload: { r: 1 }, startedAt: 1 };
    await store.writeWorkflowRunCheckpoint({
      ...run,
      header: makeHeader('r1'),
      // An input that happens to look like a successful result.
      steps: {
        input: { status: 'success', output: 1 } as any,
        a: succeeded,
        b: suspended,
        c: failed,
        d: running,
      } as any,
      state: {},
    });

    const loaded = await store.loadWorkflowRun({ ...run, successfulSteps: 'summary' });
    expect(loaded!.summarizedStepIds).toEqual(['a']);
    expect(loaded!.steps).toEqual({
      input: { status: 'success', output: 1 },
      a: { status: 'success', startedAt: 1, endedAt: 2, suspendedAt: 3, resumedAt: 4, metadata: { iterationCount: 2 } },
      b: suspended,
      c: failed,
      d: running,
    });
    expect(Object.keys(loaded!.steps)).toEqual(['input', 'a', 'b', 'c', 'd']);
  });

  it('loads the latest result of the given steps only', async () => {
    const { store } = setup();
    await store.writeWorkflowRunCheckpoint({
      ...run,
      header: makeHeader('r1'),
      steps: { a: ok(1), b: ok(2) },
      state: {},
    });
    await store.appendWorkflowRunEntries({ ...run, header: makeHeader('r1'), steps: { a: ok(10) } });

    expect(await store.loadWorkflowRunSteps({ ...run, stepIds: ['a', 'missing'] })).toEqual({ a: ok(10) });
    expect(await store.loadWorkflowRunSteps({ ...run, stepIds: [] })).toEqual({});
    expect(await store.loadWorkflowRunSteps({ workflowName: 'wf', runId: 'nope', stepIds: ['a'] })).toEqual({});
  });

  it('loads the header without the entries, and only for v2 runs', async () => {
    const { store } = setup();
    await store.writeWorkflowRunCheckpoint({ ...run, header: makeHeader('r1'), steps: { a: ok(1) }, state: {} });
    await store.persistWorkflowSnapshot({ workflowName: 'wf', runId: 'v1', snapshot: makeSnapshot('v1') });

    expect(await store.loadWorkflowRunHeader(run)).toEqual({ header: makeHeader('r1'), lastSeq: 2, startStateSeq: 2 });
    expect(await store.loadWorkflowRunHeader({ workflowName: 'wf', runId: 'v1' })).toBeNull();
    expect(await store.loadWorkflowRunHeader({ workflowName: 'wf', runId: 'nope' })).toBeNull();
    expect(await store.loadWorkflowRun({ workflowName: 'wf', runId: 'v1', successfulSteps: 'full' })).toBeNull();
  });

  it('patches the header with compare-and-set, without writing an entry', async () => {
    const { store } = setup();
    await store.writeWorkflowRunCheckpoint({ ...run, header: makeHeader('r1'), steps: { a: ok(1) }, state: {} });
    await store.persistWorkflowSnapshot({ workflowName: 'wf', runId: 'v1', snapshot: makeSnapshot('v1') });

    expect(
      await store.updateWorkflowRunHeader({ ...run, opts: { status: 'canceled', expectedStatus: 'suspended' } }),
    ).toBeUndefined();
    expect((await store.loadWorkflowRunHeader(run))!.header.status).toBe('running');

    const updated = await store.updateWorkflowRunHeader({
      ...run,
      opts: { status: 'canceled', expectedStatus: 'running', suspendedPaths: { a: [0] } },
    });
    expect(updated).toEqual({
      header: makeHeader('r1', { status: 'canceled', suspendedPaths: { a: [0] } }),
      lastSeq: 2,
      startStateSeq: 2,
    });
    expect(await store.loadWorkflowRunHeader(run)).toEqual(updated);

    expect(await store.updateWorkflowRunHeader({ workflowName: 'wf', runId: 'v1', opts: { status: 'success' } })).toBe(
      undefined,
    );
    expect((await store.loadWorkflowSnapshot({ workflowName: 'wf', runId: 'v1' }))!.status).toBe('running');
  });

  it('clones on write and on read', async () => {
    const { store } = setup();
    const a = ok({ list: [1] });
    const state = { nested: { n: 1 } };
    const header = makeHeader('r1', { activePaths: [0] });
    await store.writeWorkflowRunCheckpoint({ ...run, header, steps: { a }, state });
    a.output.list.push(2);
    state.nested.n = 2;
    header.activePaths.push(1);

    const loaded = await store.loadWorkflowRun({ ...run, successfulSteps: 'full' });
    expect(loaded).toMatchObject({ header: { activePaths: [0] }, state: { nested: { n: 1 } } });
    expect((loaded!.steps.a as any).output).toEqual({ list: [1] });

    (loaded!.steps.a as any).output.list.push(3);
    loaded!.header.activePaths.push(3);
    (await store.loadWorkflowRunHeader(run))!.header.activePaths.push(4);
    (await store.loadWorkflowRunSteps({ ...run, stepIds: ['a'] })).a!.payload.x = 1;
    expect(await store.loadWorkflowRun({ ...run, successfulSteps: 'full' })).toMatchObject({
      header: { activePaths: [0] },
      steps: { a: ok({ list: [1] }) },
    });
  });

  it('keeps createdAt and resourceId when later writes omit resourceId', async () => {
    const { store } = setup();
    await store.writeWorkflowRunCheckpoint({
      ...run,
      resourceId: 'res',
      header: makeHeader('r1'),
      steps: {},
      state: {},
    });
    const createdAt = (await store.getWorkflowRunById({ runId: 'r1' }))!.createdAt;
    await new Promise(resolve => setTimeout(resolve, 5));
    await store.appendWorkflowRunEntries({ ...run, header: makeHeader('r1'), steps: { a: ok(1) } });
    await store.writeWorkflowRunCheckpoint({ ...run, header: makeHeader('r1'), steps: {}, state: {} });

    const stored = await store.getWorkflowRunById({ runId: 'r1' });
    expect(stored!.createdAt).toEqual(createdAt);
    expect(stored!.updatedAt.getTime()).toBeGreaterThan(createdAt.getTime());
    expect(stored!.resourceId).toBe('res');
  });

  it('checks the fence on every write', async () => {
    const { store } = setup();
    await store.writeWorkflowRunCheckpoint({ ...run, header: makeHeader('r1'), steps: { a: ok(1) }, state: {} });
    const claim = await store.claimRunOwnership({ runId: 'r1', ownerId: 'a', leaseMs: 60_000 });
    await store.claimRunOwnership({ runId: 'r1', ownerId: 'b', leaseMs: 60_000, force: true });
    const fence = { runId: 'r1', generation: claim.record!.generation, ownerId: 'a' };

    await expect(
      store.writeWorkflowRunCheckpoint({ ...run, header: makeHeader('r1'), steps: {}, state: {}, fence }),
    ).rejects.toBeInstanceOf(RunFenceConflictError);
    await expect(
      store.appendWorkflowRunEntries({ ...run, header: makeHeader('r1'), steps: { b: ok(2) }, fence }),
    ).rejects.toBeInstanceOf(RunFenceConflictError);
    await expect(store.updateWorkflowRunHeader({ ...run, opts: { status: 'canceled' }, fence })).rejects.toBeInstanceOf(
      RunFenceConflictError,
    );

    expect(await store.loadWorkflowRun({ ...run, successfulSteps: 'full' })).toMatchObject({
      header: { status: 'running' },
      lastSeq: 2,
      steps: { a: ok(1) },
    });
  });

  it('throws from the base class for adapters that do not implement them', async () => {
    const { store } = setup();
    for (const method of [
      'loadWorkflowRunHeader',
      'loadWorkflowRun',
      'loadWorkflowRunSteps',
      'updateWorkflowRunHeader',
      'writeWorkflowRunCheckpoint',
      'appendWorkflowRunEntries',
    ] as const) {
      await expect((WorkflowsStorage.prototype[method] as any).call(store, {})).rejects.toMatchObject({
        id: 'STORAGE_RUN_JOURNAL_NOT_SUPPORTED',
      });
    }
  });
});

describe('WorkflowsInMemory storage v2 state patches', () => {
  const parent = { workflowName: 'parent', runId: 'r1' };
  const child = { workflowName: 'child', runId: 'r1' };
  const grandchild = { workflowName: 'grandchild', runId: 'r1' };
  const childOf = (workflowId: string, overrides: Record<string, any> = {}) =>
    makeHeader('r1', { parentWorkflow: { workflowId, runId: 'r1', stepId: 'nested' }, ...overrides });
  const set = (path: (string | number)[], value: unknown) => ({ op: 'set' as const, path, value });
  const bytes = (...ops: unknown[][]) => ops.reduce((sum: number, o) => sum + JSON.stringify(o).length, 0);

  /** The state every reader returns for a run, which must agree. */
  async function statesOf(store: WorkflowsInMemory, run: { workflowName: string; runId: string }) {
    const loaded = await store.loadWorkflowRun({ ...run, successfulSteps: 'summary' });
    const snapshot = await store.loadWorkflowSnapshot(run);
    const byId = await store.getWorkflowRunById(run);
    const listed = (await store.listWorkflowRuns({ workflowName: run.workflowName })).runs[0];
    for (const other of [
      snapshot!.value,
      (byId!.snapshot as WorkflowRunState).value,
      (listed!.snapshot as WorkflowRunState).value,
    ]) {
      expect(other).toEqual(loaded!.state);
    }
    return loaded!;
  }

  it('applies every patch after the latest full state, in order, ignoring earlier ones', async () => {
    const { db, store } = setup();
    const early = [set(['a'], 'ignored')];
    const p1 = [set(['list', 1], 'y'), { op: 'delete' as const, path: ['gone'] }];
    const p2 = [set(['n'], 2)];
    await store.writeWorkflowRunCheckpoint({ ...parent, header: makeHeader('r1'), steps: {}, state: { a: 0 } });
    await store.appendWorkflowRunEntries({ ...parent, header: makeHeader('r1'), steps: {}, statePatch: early });
    await store.appendWorkflowRunEntries({
      ...parent,
      header: makeHeader('r1'),
      steps: {},
      state: { n: 1, list: ['x'], gone: true },
    });
    await store.appendWorkflowRunEntries({ ...parent, header: makeHeader('r1'), steps: { a: ok(1) }, statePatch: p1 });
    await store.appendWorkflowRunEntries({ ...parent, header: makeHeader('r1'), steps: {}, statePatch: p2 });

    expect(db.workflowRunEntries.get('parent-r1')!.map(e => e.kind)).toEqual([
      'state',
      'state-patch',
      'state',
      'step',
      'state-patch',
      'state-patch',
    ]);
    const loaded = await statesOf(store, parent);
    expect(loaded.state).toEqual({ n: 2, list: ['x', 'y'] });
    expect(loaded.statePatchBytes).toBe(bytes(p1, p2));
    // Rebuilding doesn't touch the stored entries.
    expect((await statesOf(store, parent)).state).toEqual({ n: 2, list: ['x', 'y'] });
  });

  it('stores a checkpoint as a version of another run plus a patch', async () => {
    const { db, store } = setup();
    const { lastSeq } = await store.writeWorkflowRunCheckpoint({
      ...parent,
      header: makeHeader('r1'),
      steps: {},
      state: { p: 1 },
    });
    await store.writeWorkflowRunCheckpoint({
      ...child,
      header: childOf('parent'),
      steps: {},
      stateBase: { ...parent, seq: lastSeq },
      statePatch: [set(['n'], 1)],
    });
    expect(db.workflowRunEntries.get('child-r1')!.map(e => e.kind)).toEqual(['state-base', 'state-patch']);
    const loaded = await statesOf(store, child);
    expect(loaded.state).toEqual({ p: 1, n: 1 });
    // Only the run's own patches count.
    expect(loaded.statePatchBytes).toBe(bytes([set(['n'], 1)]));
  });

  it("starts a run from another run's state version, recursively", async () => {
    const { store } = setup();
    await store.writeWorkflowRunCheckpoint({
      ...parent,
      header: makeHeader('r1'),
      steps: {},
      state: { p: 1, list: [1] },
    });
    const { lastSeq: parentSeq } = await store.appendWorkflowRunEntries({
      ...parent,
      header: makeHeader('r1'),
      steps: {},
      statePatch: [set(['p'], 2)],
    });
    await store.writeWorkflowRunCheckpoint({
      ...child,
      header: childOf('parent'),
      steps: { input: {} as any },
      stateBase: { ...parent, seq: parentSeq },
    });
    expect((await statesOf(store, child)).state).toEqual({ p: 2, list: [1] });

    const c1 = [set(['list', 1], 2)];
    const { lastSeq: childSeq } = await store.appendWorkflowRunEntries({
      ...child,
      header: childOf('parent'),
      steps: {},
      statePatch: c1,
    });
    await store.writeWorkflowRunCheckpoint({
      ...grandchild,
      header: childOf('child'),
      steps: {},
      stateBase: { ...child, seq: childSeq },
    });
    const g1 = [set(['g'], true)];
    await store.appendWorkflowRunEntries({ ...grandchild, header: childOf('child'), steps: {}, statePatch: g1 });

    const loadedChild = await statesOf(store, child);
    expect(loadedChild.state).toEqual({ p: 2, list: [1, 2] });
    expect(loadedChild.statePatchBytes).toBe(bytes(c1));
    const loadedGrandchild = await statesOf(store, grandchild);
    expect(loadedGrandchild.state).toEqual({ p: 2, list: [1, 2], g: true });
    expect(loadedGrandchild.statePatchBytes).toBe(bytes(g1));
    // The parent's state is untouched by its children's patches.
    expect((await statesOf(store, parent)).state).toEqual({ p: 2, list: [1] });
  });

  it("keeps reading the version it was built on after the other run's state moves on or starts over", async () => {
    const { store } = setup();
    const { lastSeq } = await store.writeWorkflowRunCheckpoint({
      ...parent,
      header: makeHeader('r1'),
      steps: {},
      state: { list: ['a', 'b', 'c'] },
    });
    await store.writeWorkflowRunCheckpoint({
      ...child,
      header: childOf('parent'),
      steps: {},
      stateBase: { ...parent, seq: lastSeq },
    });
    await store.appendWorkflowRunEntries({
      ...child,
      header: childOf('parent'),
      steps: {},
      statePatch: [set(['list', 3], 'd')],
    });

    // The parent shrinks its list, then a checkpoint (time travel) starts its state over.
    await store.appendWorkflowRunEntries({ ...parent, header: makeHeader('r1'), steps: {}, state: { list: ['x'] } });
    expect((await statesOf(store, child)).state).toEqual({ list: ['a', 'b', 'c', 'd'] });
    await store.writeWorkflowRunCheckpoint({ ...parent, header: makeHeader('r1'), steps: {}, state: { other: 1 } });
    expect((await statesOf(store, child)).state).toEqual({ list: ['a', 'b', 'c', 'd'] });

    // A full state replaces the base.
    await store.appendWorkflowRunEntries({ ...child, header: childOf('parent'), steps: {}, state: { own: true } });
    expect((await statesOf(store, child)).state).toEqual({ own: true });
  });

  it('starts from an empty state when the base run is not stored, or the checkpoint has no state', async () => {
    const { store } = setup();
    await store.writeWorkflowRunCheckpoint({
      ...child,
      header: childOf('missing'),
      steps: {},
      stateBase: { workflowName: 'missing', runId: 'r1', seq: 3 },
    });
    await store.appendWorkflowRunEntries({
      ...child,
      header: childOf('missing'),
      steps: {},
      statePatch: [set(['c'], 1)],
    });
    expect((await statesOf(store, child)).state).toEqual({ c: 1 });

    await store.appendWorkflowRunEntries({ ...parent, header: makeHeader('r1'), steps: {}, state: { p: 1 } });
    await store.writeWorkflowRunCheckpoint({ ...parent, header: makeHeader('r1'), steps: {} });
    expect((await statesOf(store, parent)).state).toEqual({});
  });

  it("serves a run's drafts to runs built on them, and leaves them out of the run's own state", async () => {
    const { db, store } = setup();
    const { lastSeq } = await store.writeWorkflowRunCheckpoint({
      ...parent,
      header: makeHeader('r1'),
      steps: {},
      state: { list: ['a'] },
    });
    const d1 = await store.appendWorkflowRunStateDraft({
      ...parent,
      on: { seq: lastSeq },
      ops: [set(['list', 1], 'b')],
    });
    const d2 = await store.appendWorkflowRunStateDraft({
      ...parent,
      on: { ...d1, draft: true },
      ops: [set(['list', 2], 'c')],
    });
    const full = await store.appendWorkflowRunStateDraft({ ...parent, state: { list: ['z'] } });
    const d3 = await store.appendWorkflowRunStateDraft({
      ...parent,
      on: { ...full, draft: true },
      ops: [set(['n'], 1)],
    });
    expect(db.workflowRunEntries.get('parent-r1')!.map(e => e.kind)).toEqual([
      'state',
      'state-draft',
      'state-draft',
      'state-draft',
      'state-draft',
    ]);

    const childOn = async (name: string, seq: number) => {
      const run = { workflowName: name, runId: 'r1' };
      await store.writeWorkflowRunCheckpoint({
        ...run,
        header: childOf('parent'),
        steps: {},
        stateBase: { ...parent, seq, draft: true },
      });
      return (await store.loadWorkflowRun({ ...run, successfulSteps: 'summary' }))!.state;
    };
    expect(await childOn('c1', d1.seq)).toEqual({ list: ['a', 'b'] });
    expect(await childOn('c2', d2.seq)).toEqual({ list: ['a', 'b', 'c'] });
    expect(await childOn('c3', d3.seq)).toEqual({ list: ['z'], n: 1 });

    // Drafts never change the run's own state, so a restart reads the stored one.
    const loaded = await statesOf(store, parent);
    expect(loaded.state).toEqual({ list: ['a'] });
    expect(loaded.statePatchBytes).toBe(0);
    // A later state patch applies to the stored state, not to a draft.
    await store.appendWorkflowRunEntries({
      ...parent,
      header: makeHeader('r1'),
      steps: {},
      statePatch: [set(['m'], 1)],
    });
    expect((await statesOf(store, parent)).state).toEqual({ list: ['a'], m: 1 });
  });

  it('fails a draft of a run that is not stored', async () => {
    const { store } = setup();
    await expect(store.appendWorkflowRunStateDraft({ ...parent, state: {} })).rejects.toThrow();
  });

  it('keeps the state of the runs built on a deleted run', async () => {
    const { db, store } = setup();
    const { lastSeq } = await store.writeWorkflowRunCheckpoint({
      ...parent,
      header: makeHeader('r1'),
      steps: {},
      state: { list: ['a'] },
    });
    const draft = await store.appendWorkflowRunStateDraft({
      ...parent,
      on: { seq: lastSeq },
      ops: [set(['list', 1], 'b')],
    });
    await store.writeWorkflowRunCheckpoint({
      ...child,
      header: childOf('parent'),
      steps: {},
      stateBase: { ...parent, seq: lastSeq },
      statePatch: [set(['c'], 1)],
    });
    const { lastSeq: childSeq } = await store.writeWorkflowRunCheckpoint({
      workflowName: 'sibling',
      runId: 'r1',
      header: childOf('parent'),
      steps: {},
      stateBase: { ...parent, seq: draft.seq, draft: true },
    });
    await store.writeWorkflowRunCheckpoint({
      ...grandchild,
      header: childOf('sibling'),
      steps: {},
      stateBase: { workflowName: 'sibling', runId: 'r1', seq: childSeq },
    });

    await store.deleteWorkflowRunById(parent);
    expect(db.workflowRunEntries.has('parent-r1')).toBe(false);
    expect((await statesOf(store, child)).state).toEqual({ list: ['a'], c: 1 });
    expect(db.workflowRunEntries.get('child-r1')!.map(e => e.kind)).toEqual(['state', 'state-patch']);
    expect((await statesOf(store, { workflowName: 'sibling', runId: 'r1' })).state).toEqual({ list: ['a', 'b'] });
    expect((await statesOf(store, grandchild)).state).toEqual({ list: ['a', 'b'] });
    // A run recreated under the deleted key starts its seq over without changing them.
    await store.writeWorkflowRunCheckpoint({ ...parent, header: makeHeader('r1'), steps: {}, state: { other: 1 } });
    expect((await statesOf(store, child)).state).toEqual({ list: ['a'], c: 1 });
  });
});

describe('summarizeStepResult', () => {
  it('keeps the summary fields that are set, and nothing else', () => {
    const result = { ...ok('data'), metadata: { nestedRunId: 'n1' }, resumePayload: { r: 1 } };
    expect(summarizeStepResult(result)).toEqual({
      status: 'success',
      startedAt: 1,
      endedAt: 2,
      metadata: { nestedRunId: 'n1' },
    });
    expect(Object.keys(summarizeStepResult(ok(1)))).toEqual(['status', 'startedAt', 'endedAt']);
  });
});

describe('materializeWorkflowRun', () => {
  it('takes the latest entry per step and the latest state', () => {
    const header = { runId: 'r1', status: 'running' } as any;
    const state = materializeWorkflowRun(header, [
      { seq: 1, kind: 'step', stepId: 'a', result: ok(1) },
      { seq: 2, kind: 'state', state: { n: 1 } },
      { seq: 3, kind: 'step', stepId: 'b', result: ok(2) },
      { seq: 4, kind: 'step', stepId: 'a', result: ok(3) },
      { seq: 5, kind: 'state', state: { n: 2 } },
    ]);

    expect(state).toEqual({ runId: 'r1', status: 'running', context: { a: ok(3), b: ok(2) }, value: { n: 2 } });
  });

  it('defaults to an empty state without a state entry', () => {
    expect(materializeWorkflowRun({ runId: 'r1' } as any, [])).toMatchObject({ context: {}, value: {} });
  });

  it('applies patches to the parent state only without a full state entry, never mutating it', () => {
    const parentState = { p: { n: 1 } };
    const patch = { seq: 1, kind: 'state-patch' as const, ops: [{ op: 'set' as const, path: ['p', 'n'], value: 2 }] };

    expect(materializeWorkflowRun({ runId: 'r1' } as any, [patch], parentState).value).toEqual({ p: { n: 2 } });
    expect(parentState).toEqual({ p: { n: 1 } });
    expect(
      materializeWorkflowRun({ runId: 'r1' } as any, [{ seq: 0, kind: 'state', state: { own: 1 } }, patch], parentState)
        .value,
    ).toEqual({ own: 1, p: { n: 2 } });
  });
});
