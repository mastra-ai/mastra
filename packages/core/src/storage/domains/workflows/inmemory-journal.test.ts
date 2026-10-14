import { describe, expect, it } from 'vitest';
import type { WorkflowRunState } from '../../../workflows';
import { RunFenceConflictError } from '../../run-fencing';
import { InMemoryDB } from '../inmemory-db';
import { WorkflowsInMemory } from './inmemory';
import { materializeWorkflowRun } from './journal';

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
