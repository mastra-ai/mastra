import type { WorkflowsStorage, WorkflowRun } from '@mastra/core/storage';
import { isRunFenceConflictError } from '@mastra/core/storage';
import type { StepResult, WorkflowRunState } from '@mastra/core/workflows';
import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { createSampleSuspendedSnapshotWithThread } from './data';

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

const ok = (output: unknown) =>
  ({ status: 'success', output, payload: {}, startedAt: 1, endedAt: 2 }) as StepResult<any, any, any, any>;

const parsed = (run: WorkflowRun) =>
  (typeof run.snapshot === 'string' ? JSON.parse(run.snapshot) : run.snapshot) as WorkflowRunState;

/**
 * Conformance cases for storage v2 runs (`storageVersion: 2`), stored as a header plus
 * append-only entries. Skipped for adapters whose `supportsRunJournal()` is false.
 */
export function createRunJournalTests({ getStore }: { getStore: () => WorkflowsStorage }) {
  describe('storage v2 runs', () => {
    let store: WorkflowsStorage;
    let workflowName: string;

    beforeEach(ctx => {
      store = getStore();
      if (!store.supportsRunJournal()) return ctx.skip();
      workflowName = `wf-${randomUUID()}`;
    });

    const runId = () => `run-${randomUUID()}`;
    const load = (id: string, storageVersion?: 1 | 2) =>
      store.loadWorkflowSnapshot({ workflowName, runId: id, storageVersion });
    const checkpoint = (id: string, snapshot: WorkflowRunState, extra: Record<string, any> = {}) =>
      store.persistWorkflowSnapshot({ workflowName, runId: id, snapshot, storageVersion: 2, ...extra });
    const append = (id: string, snapshot: WorkflowRunState, stepIds: string[], state = false) =>
      store.persistWorkflowSnapshot({
        workflowName,
        runId: id,
        snapshot,
        storageVersion: 2,
        changes: { stepIds, state },
      });

    describe('writes', () => {
      it('round-trips a checkpoint', async () => {
        const id = runId();
        const snapshot = makeSnapshot(id, {
          context: { input: { q: 1 }, a: ok(1), b: ok({ nested: [1, 2] }) },
          value: { n: 1 },
          suspendedPaths: { b: [1] },
          activeStepsPath: { b: [1] },
        });
        await checkpoint(id, snapshot);
        expect(await load(id)).toEqual(snapshot);
      });

      it('appends only the listed steps, and the state when asked', async () => {
        const id = runId();
        const context: Record<string, any> = { input: {}, a: ok(1) };
        const snapshot = makeSnapshot(id, { context, value: { n: 1 } });
        await checkpoint(id, snapshot);

        context.b = ok(2);
        context.a = ok('not listed');
        await append(id, makeSnapshot(id, { context, value: { n: 2 } }), ['b']);
        let loaded = await load(id);
        expect(loaded!.context).toEqual({ input: {}, a: ok(1), b: ok(2) });
        expect(loaded!.value).toEqual({ n: 1 });

        context.a = ok(10);
        await append(id, makeSnapshot(id, { context, status: 'success', value: { n: 3 } }), ['a'], true);
        loaded = await load(id);
        expect(loaded!.context).toEqual({ input: {}, a: ok(10), b: ok(2) });
        expect(loaded!.value).toEqual({ n: 3 });
        expect(loaded!.status).toBe('success');
      });

      it('rebuilds the same run when an append is repeated', async () => {
        const id = runId();
        const snapshot = makeSnapshot(id, { context: { input: {}, a: ok(1) }, value: { n: 1 } });
        await checkpoint(id, snapshot);

        const next = makeSnapshot(id, { context: { input: {}, a: ok(1), b: ok(2) }, value: { n: 2 } });
        await append(id, next, ['b'], true);
        await append(id, next, ['b'], true);

        expect(await load(id)).toEqual(next);
      });

      it('rebuilds many writes of one step to the latest', async () => {
        const id = runId();
        const context: Record<string, any> = { input: {}, loop: ok(0) };
        const snapshot = makeSnapshot(id, { context });
        await checkpoint(id, snapshot);
        for (let i = 1; i <= 30; i++) {
          context.loop = ok(i);
          await append(id, snapshot, ['loop']);
        }

        expect((await load(id))!.context.loop).toEqual(ok(30));
        const run = await store.getWorkflowRunById({ workflowName, runId: id });
        expect(parsed(run!).context.loop).toEqual(ok(30));
        const { runs } = await store.listWorkflowRuns({ workflowName });
        expect(parsed(runs[0]!).context.loop).toEqual(ok(30));
      });

      it('replaces all earlier entries on a checkpoint, and later writes still win', async () => {
        const id = runId();
        await checkpoint(id, makeSnapshot(id, { context: { input: {}, a: ok(1), b: ok(2) }, value: { n: 1 } }));
        await append(id, makeSnapshot(id, { context: { input: {}, a: ok(3), b: ok(2) } }), ['a']);

        await checkpoint(id, makeSnapshot(id, { context: { input: {}, a: ok(4) }, value: { fresh: true } }));
        let loaded = await load(id);
        expect(loaded!.context).toEqual({ input: {}, a: ok(4) });
        expect(loaded!.value).toEqual({ fresh: true });

        await append(id, makeSnapshot(id, { context: { input: {}, a: ok(5) } }), ['a']);
        loaded = await load(id);
        expect(loaded!.context).toEqual({ input: {}, a: ok(5) });
      });

      it('writes a checkpoint when appending to a run that is not stored', async () => {
        const id = runId();
        const snapshot = makeSnapshot(id, { context: { input: {}, a: ok(1) }, value: { n: 1 } });
        await append(id, snapshot, []);
        expect(await load(id)).toEqual(snapshot);
      });

      it('copies on write and read, so later edits do not reach storage', async () => {
        const id = runId();
        const a = ok({ list: [1] }) as any;
        const value = { nested: { n: 1 } };
        const snapshot = makeSnapshot(id, { context: { a }, value, activePaths: [0] });
        await checkpoint(id, snapshot);

        a.output.list.push(2);
        value.nested.n = 2;
        snapshot.activePaths.push(1);

        const loaded = await load(id);
        expect(loaded!.context.a).toMatchObject({ output: { list: [1] } });
        expect(loaded!.value).toEqual({ nested: { n: 1 } });
        expect(loaded!.activePaths).toEqual([0]);

        (loaded!.context.a as any).output.list.push(3);
        expect((await load(id))!.context.a).toMatchObject({ output: { list: [1] } });
      });

      it('keeps createdAt and resourceId across re-persists that omit them', async () => {
        const id = runId();
        await checkpoint(id, makeSnapshot(id), { resourceId: 'res', createdAt: new Date(1000) });
        await append(id, makeSnapshot(id), []);
        await checkpoint(id, makeSnapshot(id));

        const run = await store.getWorkflowRunById({ workflowName, runId: id });
        expect(run!.createdAt.getTime()).toBe(1000);
        expect(run!.resourceId).toBe('res');
      });
    });

    describe('patches', () => {
      it('patches the header with compare-and-set, and returns the rebuilt run', async () => {
        const id = runId();
        await checkpoint(id, makeSnapshot(id, { context: { a: ok(1) }, value: { n: 1 } }));

        const skipped = await store.updateWorkflowState({
          workflowName,
          runId: id,
          opts: { status: 'canceled', expectedStatus: 'suspended' },
        });
        expect(skipped).toBeUndefined();
        expect((await load(id))!.status).toBe('running');

        const updated = await store.updateWorkflowState({
          workflowName,
          runId: id,
          opts: { status: 'canceled', expectedStatus: 'running' },
        });
        expect(updated).toMatchObject({ status: 'canceled', context: { a: ok(1) }, value: { n: 1 } });
        expect(await load(id)).toMatchObject({ status: 'canceled', context: { a: ok(1) }, value: { n: 1 } });

        // A version hint limits the patch to that version.
        expect(
          await store.updateWorkflowState({
            workflowName,
            runId: id,
            opts: { status: 'success' },
            storageVersion: 1,
          }),
        ).toBeUndefined();
        expect((await load(id))!.status).toBe('canceled');
      });

      it('rejects updateWorkflowResults', async () => {
        const id = runId();
        await checkpoint(id, makeSnapshot(id));

        await expect(
          store.updateWorkflowResults({ workflowName, runId: id, stepId: 'a', result: ok(1), requestContext: {} }),
        ).rejects.toThrow(/storage v2/);
      });
    });

    describe('reads, lists and deletes', () => {
      it('finds runs of either version, unless a version is given', async () => {
        await store.persistWorkflowSnapshot({
          workflowName,
          runId: 'v1-run',
          resourceId: 'res',
          snapshot: makeSnapshot('v1-run', { status: 'success' }),
        });
        await checkpoint('v2-run', makeSnapshot('v2-run', { status: 'suspended', context: { a: ok(1) } }), {
          resourceId: 'res',
        });

        expect(await load('v1-run')).toMatchObject({ status: 'success' });
        expect(await load('v2-run')).toMatchObject({ status: 'suspended', context: { a: ok(1) } });
        expect(await load('v2-run', 2)).toMatchObject({ status: 'suspended' });
        expect(await load('v1-run', 1)).toMatchObject({ status: 'success' });
        expect(await load('v2-run', 1)).toBeNull();
        expect(await load('v1-run', 2)).toBeNull();

        const v2 = await store.getWorkflowRunById({ runId: 'v2-run', workflowName });
        expect(v2).toMatchObject({ runId: 'v2-run', workflowName, resourceId: 'res', storageVersion: 2 });
        expect(parsed(v2!)).toMatchObject({ status: 'suspended', context: { a: ok(1) } });
        expect(await store.getWorkflowRunById({ runId: 'v2-run', workflowName, storageVersion: 2 })).toMatchObject({
          runId: 'v2-run',
        });
        expect(await store.getWorkflowRunById({ runId: 'v2-run', workflowName, storageVersion: 1 })).toBeNull();

        const v1 = await store.getWorkflowRunById({ runId: 'v1-run', workflowName });
        expect(v1).toMatchObject({ runId: 'v1-run', workflowName, resourceId: 'res' });
        expect(v1!.storageVersion).toBeUndefined();
        expect(await store.getWorkflowRunById({ runId: 'v1-run', workflowName, storageVersion: 2 })).toBeNull();
      });

      it('lists both versions together, newest first across pages', async () => {
        const created = (s: number) => ({ createdAt: new Date(Date.UTC(2024, 0, 1, 0, 0, s)) });
        await store.persistWorkflowSnapshot({ workflowName, runId: 'r1', snapshot: makeSnapshot('r1'), ...created(1) });
        await checkpoint('r2', makeSnapshot('r2', { context: { a: ok(2) } }), created(2));
        await store.persistWorkflowSnapshot({ workflowName, runId: 'r3', snapshot: makeSnapshot('r3'), ...created(3) });
        await checkpoint('r4', makeSnapshot('r4', { context: { a: ok(4) } }), created(4));

        const page0 = await store.listWorkflowRuns({ workflowName, perPage: 2, page: 0 });
        const page1 = await store.listWorkflowRuns({ workflowName, perPage: 2, page: 1 });
        expect(page0.total).toBe(4);
        expect(page1.total).toBe(4);
        expect(page0.runs.map(r => r.runId)).toEqual(['r4', 'r3']);
        expect(page1.runs.map(r => r.runId)).toEqual(['r2', 'r1']);

        const [r4, r3] = page0.runs;
        expect(r4).toMatchObject({ workflowName, storageVersion: 2 });
        expect(parsed(r4!).context).toEqual({ a: ok(4) });
        expect(r3!.storageVersion).toBeUndefined();

        const all = await store.listWorkflowRuns({ workflowName });
        expect(all.runs.map(r => r.runId)).toEqual(['r4', 'r3', 'r2', 'r1']);
        expect(all.total).toBe(4);
      });

      it('filters v2 runs by status, resourceId and date', async () => {
        const resourceId = `res-${randomUUID()}`;
        const at = (s: number) => new Date(Date.UTC(2024, 0, 1, 0, 0, s));
        await checkpoint('a', makeSnapshot('a', { status: 'suspended' }), { resourceId, createdAt: at(1) });
        await checkpoint('b', makeSnapshot('b', { status: 'success' }), { createdAt: at(2) });
        await checkpoint('c', makeSnapshot('c', { status: 'suspended' }), { createdAt: at(3) });

        const ids = async (filter: Record<string, any>) =>
          (await store.listWorkflowRuns({ workflowName, ...filter })).runs.map(r => r.runId);

        expect(await ids({ status: 'suspended' })).toEqual(['c', 'a']);
        expect(await ids({ resourceId })).toEqual(['a']);
        expect(await ids({ fromDate: at(2) })).toEqual(['c', 'b']);
        expect(await ids({ toDate: at(2) })).toEqual(['b', 'a']);
        expect(await ids({ fromDate: at(2), toDate: at(2) })).toEqual(['b']);
        expect((await store.listWorkflowRuns({ resourceId })).runs.map(r => r.runId)).toEqual(['a']);

        // A patched status is what the filter sees.
        await store.updateWorkflowState({ workflowName, runId: 'b', opts: { status: 'suspended' } });
        expect(await ids({ status: 'suspended' })).toEqual(['c', 'b', 'a']);
      });

      it('includes v2 runs in threadId filters, including a thread an append added', async () => {
        const threadId = `thread-${randomUUID()}`;
        const durable = createSampleSuspendedSnapshotWithThread({ threadId, layout: 'durable' });
        await checkpoint(durable.runId, durable.snapshot);

        const agentic = createSampleSuspendedSnapshotWithThread({ threadId, layout: 'agentic-loop' });
        await checkpoint(agentic.runId, { ...agentic.snapshot, status: 'running', context: { input: {} } as any });
        await append(agentic.runId, agentic.snapshot, [agentic.stepId]);

        const { runs } = await store.listWorkflowRuns({ workflowName, threadId });
        expect(runs.map(r => r.runId)).toEqual(expect.arrayContaining([durable.runId, agentic.runId]));
      });

      it('returns status and timestamp in summary mode', async () => {
        const id = runId();
        await checkpoint(id, makeSnapshot(id, { status: 'success', timestamp: 1234, context: { a: ok(1) } }));

        const { runs, total } = await store.listWorkflowRuns({ workflowName, summary: true });
        expect(total).toBe(1);
        expect(runs[0]).toMatchObject({ runId: id, storageVersion: 2 });
        expect(parsed(runs[0]!)).toMatchObject({ status: 'success', timestamp: 1234 });
      });

      it('deletes runs of either version', async () => {
        await store.persistWorkflowSnapshot({ workflowName, runId: 'v1-run', snapshot: makeSnapshot('v1-run') });
        await checkpoint('v2-run', makeSnapshot('v2-run', { context: { a: ok(1) } }));
        await checkpoint('other', makeSnapshot('other', { context: { a: ok(1) } }));

        await store.deleteWorkflowRunById({ workflowName, runId: 'v2-run' });
        await store.deleteWorkflowRunById({ workflowName, runId: 'v1-run' });
        expect(await store.getWorkflowRunById({ workflowName, runId: 'v2-run' })).toBeNull();
        expect(await store.getWorkflowRunById({ workflowName, runId: 'v1-run' })).toBeNull();
        expect(await load('v2-run')).toBeNull();
        expect((await store.listWorkflowRuns({ workflowName })).runs.map(r => r.runId)).toEqual(['other']);

        // A run written again after its deletion starts from its new checkpoint.
        await append('v2-run', makeSnapshot('v2-run', { context: { b: ok(2) } }), ['b']);
        expect((await load('v2-run'))!.context).toEqual({ b: ok(2) });
      });
    });

    describe('fencing', () => {
      beforeEach(async ctx => {
        if (!(await store.supportsRunFencing())) ctx.skip();
      });

      it('rejects stale fences on every write, and writes nothing', async () => {
        const id = runId();
        const original = makeSnapshot(id, { context: { a: ok(1) }, value: { n: 1 } });
        await checkpoint(id, original);

        const claim = await store.claimRunOwnership({ runId: id, ownerId: 'a', leaseMs: 60_000 });
        expect(claim.acquired).toBe(true);
        const takeover = await store.claimRunOwnership({ runId: id, ownerId: 'b', leaseMs: 60_000, force: true });
        expect(takeover.acquired).toBe(true);
        const fence = { runId: id, ownerId: 'a', generation: claim.record!.generation };
        const changed = makeSnapshot(id, { status: 'success', context: { a: ok(2), b: ok(3) }, value: { n: 2 } });

        const rejected = (write: Promise<unknown>) => expect(write).rejects.toSatisfy(isRunFenceConflictError);
        await rejected(
          store.persistWorkflowSnapshot({
            workflowName,
            runId: id,
            snapshot: changed,
            storageVersion: 2,
            changes: { stepIds: ['a', 'b'], state: true },
            fence,
          }),
        );
        await rejected(checkpoint(id, changed, { fence }));
        await rejected(
          store.updateWorkflowState({
            workflowName,
            runId: id,
            opts: { status: 'canceled' },
            storageVersion: 2,
            fence,
          }),
        );
        await rejected(store.deleteWorkflowRunById({ workflowName, runId: id, fence }));
        expect(await load(id)).toEqual(original);

        const fresh = runId();
        const claimFresh = await store.claimRunOwnership({ runId: fresh, ownerId: 'a', leaseMs: 60_000 });
        await store.claimRunOwnership({ runId: fresh, ownerId: 'b', leaseMs: 60_000, force: true });
        await rejected(
          checkpoint(fresh, makeSnapshot(fresh), {
            fence: { runId: fresh, ownerId: 'a', generation: claimFresh.record!.generation },
          }),
        );
        expect(await load(fresh)).toBeNull();
      });
    });
  });
}
