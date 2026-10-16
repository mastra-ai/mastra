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

describe('WorkflowsInMemory storage v2', () => {
  it('supports run journals', () => {
    expect(setup().store.supportsRunJournal()).toBe(true);
  });

  it('writes a checkpoint as one entry per step plus the state, outside the v1 store', async () => {
    const { db, store } = setup();
    const snapshot = makeSnapshot('r1', { context: { input: {}, a: ok(1), b: ok(2) } as any, value: { n: 1 } });

    await store.persistWorkflowSnapshot({ workflowName: 'wf', runId: 'r1', snapshot, storageVersion: 2 });

    expect(db.workflows.size).toBe(0);
    expect(db.workflowRunEntries.get('wf-r1')!.map(e => (e.kind === 'step' ? e.stepId : 'state'))).toEqual([
      'input',
      'a',
      'b',
      'state',
    ]);
    const header = db.workflowRunHeaders.get('wf-r1')!.header;
    expect(header).not.toHaveProperty('context');
    expect(header).not.toHaveProperty('value');
    expect(await store.loadWorkflowSnapshot({ workflowName: 'wf', runId: 'r1' })).toEqual(snapshot);
  });

  it('appends only the listed steps, and the state when asked', async () => {
    const { db, store } = setup();
    const context: Record<string, any> = { input: {}, a: ok(1) };
    const snapshot = makeSnapshot('r1', { context, value: { n: 1 } });
    await store.persistWorkflowSnapshot({ workflowName: 'wf', runId: 'r1', snapshot, storageVersion: 2 });

    context.b = ok(2);
    await store.persistWorkflowSnapshot({
      workflowName: 'wf',
      runId: 'r1',
      snapshot: { ...snapshot, value: { n: 2 } },
      storageVersion: 2,
      changes: { stepIds: ['b'], state: false },
    });
    // The state wasn't listed, so the stored state is still the checkpoint's.
    let loaded = await store.loadWorkflowSnapshot({ workflowName: 'wf', runId: 'r1' });
    expect(loaded!.context).toEqual({ input: {}, a: ok(1), b: ok(2) });
    expect(loaded!.value).toEqual({ n: 1 });

    context.a = ok(10);
    await store.persistWorkflowSnapshot({
      workflowName: 'wf',
      runId: 'r1',
      snapshot: { ...snapshot, status: 'success', value: { n: 3 } },
      storageVersion: 2,
      changes: { stepIds: ['a'], state: true },
    });
    loaded = await store.loadWorkflowSnapshot({ workflowName: 'wf', runId: 'r1' });
    expect(loaded!.context).toEqual({ input: {}, a: ok(10), b: ok(2) });
    expect(loaded!.value).toEqual({ n: 3 });
    expect(loaded!.status).toBe('success');

    const entries = db.workflowRunEntries.get('wf-r1')!;
    expect(entries.map(e => e.seq)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(entries).toHaveLength(6);
  });

  it('replaces all entries on a later checkpoint, keeping seq increasing', async () => {
    const { db, store } = setup();
    await store.persistWorkflowSnapshot({
      workflowName: 'wf',
      runId: 'r1',
      snapshot: makeSnapshot('r1', { context: { input: {}, a: ok(1), b: ok(2) } as any }),
      storageVersion: 2,
    });

    await store.persistWorkflowSnapshot({
      workflowName: 'wf',
      runId: 'r1',
      snapshot: makeSnapshot('r1', { context: { input: {} } as any, value: { fresh: true } }),
      storageVersion: 2,
    });

    const loaded = await store.loadWorkflowSnapshot({ workflowName: 'wf', runId: 'r1' });
    expect(loaded!.context).toEqual({ input: {} });
    expect(loaded!.value).toEqual({ fresh: true });
    expect(db.workflowRunEntries.get('wf-r1')!.map(e => e.seq)).toEqual([5, 6]);
  });

  it('writes a checkpoint when appending to a run that is not stored', async () => {
    const { store } = setup();
    const snapshot = makeSnapshot('r1', { context: { input: {}, a: ok(1) } as any, value: { n: 1 } });

    await store.persistWorkflowSnapshot({
      workflowName: 'wf',
      runId: 'r1',
      snapshot,
      storageVersion: 2,
      changes: { stepIds: [], state: false },
    });

    expect(await store.loadWorkflowSnapshot({ workflowName: 'wf', runId: 'r1' })).toEqual(snapshot);
  });

  it('clones on write, so later edits to the snapshot do not reach storage', async () => {
    const { store } = setup();
    const a = ok({ list: [1] });
    const value = { nested: { n: 1 } };
    const snapshot = makeSnapshot('r1', { context: { a } as any, value, activePaths: [0] });
    await store.persistWorkflowSnapshot({ workflowName: 'wf', runId: 'r1', snapshot, storageVersion: 2 });

    a.output.list.push(2);
    value.nested.n = 2;
    snapshot.activePaths.push(1);

    const loaded = await store.loadWorkflowSnapshot({ workflowName: 'wf', runId: 'r1' });
    expect(loaded!.context.a).toMatchObject({ output: { list: [1] } });
    expect(loaded!.value).toEqual({ nested: { n: 1 } });
    expect(loaded!.activePaths).toEqual([0]);

    // Reads are copies too.
    (loaded!.context.a as any).output.list.push(3);
    const again = await store.loadWorkflowSnapshot({ workflowName: 'wf', runId: 'r1' });
    expect(again!.context.a).toMatchObject({ output: { list: [1] } });
  });

  it('patches the header with compare-and-set, and returns the rebuilt state', async () => {
    const { store } = setup();
    await store.persistWorkflowSnapshot({
      workflowName: 'wf',
      runId: 'r1',
      snapshot: makeSnapshot('r1', { context: { a: ok(1) } as any, value: { n: 1 } }),
      storageVersion: 2,
    });

    const skipped = await store.updateWorkflowState({
      workflowName: 'wf',
      runId: 'r1',
      opts: { status: 'canceled', expectedStatus: 'suspended' } as any,
    });
    expect(skipped).toBeUndefined();
    expect((await store.loadWorkflowSnapshot({ workflowName: 'wf', runId: 'r1' }))!.status).toBe('running');

    const updated = await store.updateWorkflowState({
      workflowName: 'wf',
      runId: 'r1',
      opts: { status: 'canceled', expectedStatus: 'running' } as any,
    });
    expect(updated).toMatchObject({ status: 'canceled', context: { a: ok(1) }, value: { n: 1 } });
    expect((await store.loadWorkflowSnapshot({ workflowName: 'wf', runId: 'r1' }))!.status).toBe('canceled');

    // A version hint limits the patch to that store.
    expect(
      await store.updateWorkflowState({
        workflowName: 'wf',
        runId: 'r1',
        opts: { status: 'success' },
        storageVersion: 1,
      }),
    ).toBeUndefined();
    expect((await store.loadWorkflowSnapshot({ workflowName: 'wf', runId: 'r1' }))!.status).toBe('canceled');
  });

  it('rejects updateWorkflowResults on v2 runs', async () => {
    const { store } = setup();
    await store.persistWorkflowSnapshot({
      workflowName: 'wf',
      runId: 'r1',
      snapshot: makeSnapshot('r1'),
      storageVersion: 2,
    });

    await expect(
      store.updateWorkflowResults({ workflowName: 'wf', runId: 'r1', stepId: 'a', result: ok(1), requestContext: {} }),
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
    await store.persistWorkflowSnapshot({
      workflowName: 'wf',
      runId: 'v2-run',
      resourceId: 'res',
      snapshot: makeSnapshot('v2-run', { status: 'suspended', context: { a: ok(1) } as any }),
      createdAt: new Date(2000),
      storageVersion: 2,
    });
    await store.persistWorkflowSnapshot({
      workflowName: 'other',
      runId: 'v2-other',
      snapshot: makeSnapshot('v2-other'),
      storageVersion: 2,
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

  it('preserves createdAt and resourceId across re-persists', async () => {
    const { store } = setup();
    await store.persistWorkflowSnapshot({
      workflowName: 'wf',
      runId: 'r1',
      resourceId: 'res',
      snapshot: makeSnapshot('r1'),
      createdAt: new Date(1000),
      storageVersion: 2,
    });
    await store.persistWorkflowSnapshot({
      workflowName: 'wf',
      runId: 'r1',
      snapshot: makeSnapshot('r1'),
      storageVersion: 2,
      changes: { stepIds: [], state: false },
    });

    const run = await store.getWorkflowRunById({ runId: 'r1' });
    expect(run!.createdAt.getTime()).toBe(1000);
    expect(run!.resourceId).toBe('res');
  });

  it('checks the fence on v2 writes', async () => {
    const { store } = setup();
    const claim = await store.claimRunOwnership({ runId: 'r1', ownerId: 'a', leaseMs: 60_000 });
    expect(claim.acquired).toBe(true);
    await store.claimRunOwnership({ runId: 'r1', ownerId: 'b', leaseMs: 60_000, force: true });

    await expect(
      store.persistWorkflowSnapshot({
        workflowName: 'wf',
        runId: 'r1',
        snapshot: makeSnapshot('r1'),
        storageVersion: 2,
        fence: { runId: 'r1', generation: claim.record!.generation, ownerId: 'a' },
      }),
    ).rejects.toBeInstanceOf(RunFenceConflictError);
    expect(await store.loadWorkflowSnapshot({ workflowName: 'wf', runId: 'r1' })).toBeNull();
  });
});

const makeHeader = (runId: string, overrides: Record<string, any> = {}): WorkflowRunHeader => {
  const { context: _context, value: _value, ...header } = makeSnapshot(runId, overrides);
  return header;
};

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
      state: { n: 1 },
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

  it('creates the run when appending to one that is not stored', async () => {
    const { store } = setup();
    await store.appendWorkflowRunEntries({ ...run, resourceId: 'res', header: makeHeader('r1'), steps: { a: ok(1) } });

    expect(await store.loadWorkflowRun({ ...run, successfulSteps: 'full' })).toEqual({
      header: makeHeader('r1'),
      lastSeq: 1,
      state: {},
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

    expect(await store.loadWorkflowRunHeader(run)).toEqual({ header: makeHeader('r1'), lastSeq: 2 });
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
});
