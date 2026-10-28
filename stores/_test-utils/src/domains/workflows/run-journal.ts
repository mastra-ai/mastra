import type { WorkflowsStorage, WorkflowRun, WorkflowRunHeader } from '@mastra/core/storage';
import { getSnapshotMemoryInfo, isRunFenceConflictError, summarizeStepResult } from '@mastra/core/storage';
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

const makeHeader = (runId: string, overrides: Record<string, any> = {}): WorkflowRunHeader => {
  const { context: _context, value: _value, ...header } = makeSnapshot(runId, overrides);
  return header;
};

const ok = (output: unknown) =>
  ({ status: 'success', output, payload: {}, startedAt: 1, endedAt: 2 }) as StepResult<any, any, any, any>;

const parsed = (run: WorkflowRun) =>
  (typeof run.snapshot === 'string' ? JSON.parse(run.snapshot) : run.snapshot) as WorkflowRunState;

// Runs are listed by createdAt, which v2 writes take from the clock.
const tick = () => new Promise(resolve => setTimeout(resolve, 5));

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
    const loadRun = (id: string, successfulSteps: 'full' | 'summary' = 'full') =>
      store.loadWorkflowRun({ workflowName, runId: id, successfulSteps });

    // Write a snapshot the way the engine does: the thread always comes from the whole run.
    const checkpoint = (id: string, snapshot: WorkflowRunState, extra: Record<string, any> = {}) => {
      const { context, value, ...header } = snapshot;
      return store.writeWorkflowRunCheckpoint({
        workflowName,
        runId: id,
        threadId: getSnapshotMemoryInfo(snapshot)?.threadId,
        header,
        steps: context,
        state: value,
        ...extra,
      });
    };
    const append = (
      id: string,
      snapshot: WorkflowRunState,
      stepIds: string[],
      state = false,
      extra: Record<string, any> = {},
    ) => {
      const { context, value, ...header } = snapshot;
      return store.appendWorkflowRunEntries({
        workflowName,
        runId: id,
        threadId: getSnapshotMemoryInfo(snapshot)?.threadId,
        header,
        steps: Object.fromEntries(stepIds.map(stepId => [stepId, context[stepId]!])),
        state: state ? value : undefined,
        ...extra,
      });
    };

    describe('writes', () => {
      it('round-trips a checkpoint through every reader', async () => {
        const id = runId();
        const snapshot = makeSnapshot(id, {
          context: { input: { q: 1 }, a: ok(1), b: ok({ nested: [1, 2] }) },
          value: { n: 1 },
          suspendedPaths: { b: [1] },
          activeStepsPath: { b: [1] },
        });
        await checkpoint(id, snapshot);

        const { context, value, ...header } = snapshot;
        const stored = await loadRun(id);
        expect(stored).toEqual({
          header,
          lastSeq: 4,
          startStateSeq: 4,
          state: value,
          statePatchBytes: 0,
          steps: context,
          summarizedStepIds: [],
        });
        expect(Object.keys(stored!.steps)).toEqual(['input', 'a', 'b']);
        expect(await store.loadWorkflowRunHeader({ workflowName, runId: id })).toEqual({
          header,
          lastSeq: 4,
          startStateSeq: 4,
        });
        expect(await load(id)).toEqual(snapshot);
        expect(parsed((await store.getWorkflowRunById({ workflowName, runId: id }))!)).toEqual(snapshot);
      });

      it('appends the given steps, and the state only when given', async () => {
        const id = runId();
        await checkpoint(id, makeSnapshot(id, { context: { a: ok(1), b: ok(2) }, value: { n: 1 } }));

        await store.appendWorkflowRunEntries({ workflowName, runId: id, header: makeHeader(id), steps: { c: ok(3) } });
        let stored = await loadRun(id);
        expect(stored!.state).toEqual({ n: 1 });
        expect(stored!.lastSeq).toBe(4);

        await store.appendWorkflowRunEntries({
          workflowName,
          runId: id,
          header: makeHeader(id, { status: 'success' }),
          steps: { a: ok(10) },
          state: { n: 2 },
        });
        stored = await loadRun(id);
        expect(stored!.header.status).toBe('success');
        expect(stored!.state).toEqual({ n: 2 });
        expect(stored!.lastSeq).toBe(6);
        // The latest entry per step, kept where each step was first written.
        expect(Object.entries(stored!.steps)).toEqual([
          ['a', ok(10)],
          ['b', ok(2)],
          ['c', ok(3)],
        ]);
      });

      it('replaces all earlier entries on a checkpoint, keeping seq increasing', async () => {
        const id = runId();
        await checkpoint(id, makeSnapshot(id, { context: { input: {}, a: ok(1), b: ok(2) }, value: { n: 1 } }));
        await append(id, makeSnapshot(id, { context: { input: {}, a: ok(3), b: ok(2) } }), ['a']);

        await checkpoint(id, makeSnapshot(id, { context: { input: {}, a: ok(4) }, value: { fresh: true } }));
        expect(await loadRun(id)).toMatchObject({ lastSeq: 8, steps: { input: {}, a: ok(4) }, state: { fresh: true } });
        expect(Object.keys((await loadRun(id))!.steps)).toEqual(['input', 'a']);

        await append(id, makeSnapshot(id, { context: { input: {}, a: ok(5) } }), ['a']);
        expect((await load(id))!.context).toEqual({ input: {}, a: ok(5) });
      });

      it('rebuilds the same run when an append is repeated', async () => {
        const id = runId();
        await checkpoint(id, makeSnapshot(id, { context: { input: {}, a: ok(1) }, value: { n: 1 } }));

        const next = makeSnapshot(id, { context: { input: {}, a: ok(1), b: ok(2) }, value: { n: 2 } });
        await append(id, next, ['b'], true);
        await append(id, next, ['b'], true);

        expect(await load(id)).toEqual(next);
      });

      it('rebuilds many writes of one step to the latest, in every reader', async () => {
        const id = runId();
        const context: Record<string, any> = { input: {}, loop: ok(0) };
        const snapshot = makeSnapshot(id, { context });
        await checkpoint(id, snapshot);
        for (let i = 1; i <= 30; i++) {
          context.loop = ok(i);
          await append(id, snapshot, ['loop']);
        }

        expect((await loadRun(id))!.steps.loop).toEqual(ok(30));
        expect(await store.loadWorkflowRunSteps({ workflowName, runId: id, stepIds: ['loop'] })).toEqual({
          loop: ok(30),
        });
        expect((await load(id))!.context.loop).toEqual(ok(30));
        const run = await store.getWorkflowRunById({ workflowName, runId: id });
        expect(parsed(run!).context.loop).toEqual(ok(30));
        const { runs } = await store.listWorkflowRuns({ workflowName });
        expect(parsed(runs[0]!).context.loop).toEqual(ok(30));
      });

      it('creates the run when appending to one that is not stored', async () => {
        const id = runId();
        await store.appendWorkflowRunEntries({
          workflowName,
          runId: id,
          resourceId: 'res',
          header: makeHeader(id),
          steps: { a: ok(1) },
        });

        expect(await loadRun(id)).toEqual({
          header: makeHeader(id),
          lastSeq: 1,
          startStateSeq: 0,
          state: {},
          statePatchBytes: 0,
          steps: { a: ok(1) },
          summarizedStepIds: [],
        });
        expect((await store.getWorkflowRunById({ workflowName, runId: id }))!.resourceId).toBe('res');
      });

      it('returns the last seq of each write', async () => {
        const id = runId();
        const header = makeHeader(id);
        expect(
          await store.writeWorkflowRunCheckpoint({ workflowName, runId: id, header, steps: { a: ok(1) }, state: {} }),
        ).toEqual({ lastSeq: 2 });
        expect(
          await store.appendWorkflowRunEntries({
            workflowName,
            runId: id,
            header,
            steps: { b: ok(2) },
            state: { n: 1 },
          }),
        ).toEqual({ lastSeq: 4 });
        expect(await store.appendWorkflowRunEntries({ workflowName, runId: id, header, steps: {} })).toEqual({
          lastSeq: 4,
        });
      });

      it("records the drive's start state seq, and loads the state as of a seq", async () => {
        const id = runId();
        const run = { workflowName, runId: id };
        const header = makeHeader(id);
        await store.writeWorkflowRunCheckpoint({ ...run, header, steps: { a: ok(1) }, state: { n: 1 } });
        await store.appendWorkflowRunEntries({ ...run, header, steps: {}, state: { n: 2 } });
        // Plain appends keep the checkpoint's start state.
        expect((await store.loadWorkflowRunHeader(run))!.startStateSeq).toBe(2);
        // A resumed drive's first append moves it to the version the resume started from.
        await store.appendWorkflowRunEntries({
          ...run,
          header,
          steps: {},
          statePatch: [{ op: 'set', path: ['n'], value: 4 }],
          startStateSeq: 3,
        });
        expect((await store.loadWorkflowRunHeader(run))!.startStateSeq).toBe(3);
        expect((await loadRun(id))!.startStateSeq).toBe(3);

        expect(await store.loadWorkflowRunState({ ...run, seq: 2 })).toEqual({ n: 1 });
        expect(await store.loadWorkflowRunState({ ...run, seq: 3 })).toEqual({ n: 2 });
        expect(await store.loadWorkflowRunState({ ...run, seq: 4 })).toEqual({ n: 4 });
        expect(await store.loadWorkflowRunState({ workflowName, runId: 'nope', seq: 1 })).toBeNull();

        // A later checkpoint starts a new drive.
        await store.writeWorkflowRunCheckpoint({ ...run, header, steps: {}, state: { n: 5 } });
        expect((await store.loadWorkflowRunHeader(run))!.startStateSeq).toBe(5);
      });

      it('keeps every concurrent append to one run, each under its own seq', async () => {
        const stored = runId();
        const unstored = runId();
        await checkpoint(stored, makeSnapshot(stored, { context: { input: {} } }));
        const stepIds = Array.from({ length: 20 }, (_, i) => `s${i}`);

        await Promise.all(
          [stored, unstored].flatMap(id =>
            stepIds.map(stepId =>
              store.appendWorkflowRunEntries({
                workflowName,
                runId: id,
                header: makeHeader(id),
                steps: { [stepId]: ok(stepId) },
              }),
            ),
          ),
        );

        const expected = Object.fromEntries(stepIds.map(stepId => [stepId, ok(stepId)]));
        expect(await loadRun(stored)).toMatchObject({ lastSeq: 22, steps: { input: {}, ...expected } });
        expect(await loadRun(unstored)).toMatchObject({ lastSeq: 20, steps: expected });
      });

      it('copies on write and read, so later edits do not reach storage', async () => {
        const id = runId();
        const a = ok({ list: [1] }) as any;
        const state = { nested: { n: 1 } };
        const header = makeHeader(id, { activePaths: [0] });
        await store.writeWorkflowRunCheckpoint({ workflowName, runId: id, header, steps: { a }, state });
        a.output.list.push(2);
        state.nested.n = 2;
        header.activePaths.push(1);

        const stored = await loadRun(id);
        expect(stored).toMatchObject({ header: { activePaths: [0] }, state: { nested: { n: 1 } } });
        expect((stored!.steps.a as any).output).toEqual({ list: [1] });

        (stored!.steps.a as any).output.list.push(3);
        stored!.header.activePaths.push(3);
        (await store.loadWorkflowRunHeader({ workflowName, runId: id }))!.header.activePaths.push(4);
        (await store.loadWorkflowRunSteps({ workflowName, runId: id, stepIds: ['a'] })).a!.payload.x = 1;
        expect(await loadRun(id)).toMatchObject({ header: { activePaths: [0] }, steps: { a: ok({ list: [1] }) } });
      });

      it('keeps createdAt and resourceId when later writes omit resourceId', async () => {
        const id = runId();
        await checkpoint(id, makeSnapshot(id), { resourceId: 'res' });
        const createdAt = (await store.getWorkflowRunById({ workflowName, runId: id }))!.createdAt;
        await tick();
        await append(id, makeSnapshot(id, { context: { a: ok(1) } }), ['a']);
        await checkpoint(id, makeSnapshot(id));

        const run = await store.getWorkflowRunById({ workflowName, runId: id });
        expect(run!.createdAt).toEqual(createdAt);
        expect(run!.updatedAt.getTime()).toBeGreaterThan(createdAt.getTime());
        expect(run!.resourceId).toBe('res');
      });
    });

    describe('loads', () => {
      it('summarizes successful steps only, keeping input and every other result in full', async () => {
        const id = runId();
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
        // An input that happens to look like a successful result.
        const input = { status: 'success', output: 1 };
        await checkpoint(
          id,
          makeSnapshot(id, { context: { input, a: succeeded, b: suspended, c: failed, d: running } }),
        );

        const stored = await loadRun(id, 'summary');
        expect(stored!.summarizedStepIds).toEqual(['a']);
        expect(stored!.steps).toEqual({
          input,
          a: {
            status: 'success',
            startedAt: 1,
            endedAt: 2,
            suspendedAt: 3,
            resumedAt: 4,
            metadata: { iterationCount: 2 },
          },
          b: suspended,
          c: failed,
          d: running,
        });
        expect(Object.keys(stored!.steps)).toEqual(['input', 'a', 'b', 'c', 'd']);
      });

      it('summarizes exactly like summarizeStepResult, keeping nulls and value types', async () => {
        const id = runId();
        const result = {
          status: 'success',
          output: { big: 'x' },
          payload: {},
          startedAt: 0,
          endedAt: 2,
          suspendedAt: null,
          metadata: { flag: false, n: 0, s: '', none: null, list: [], nested: { t: true } },
        };
        await checkpoint(id, makeSnapshot(id, { context: { a: result } }));

        const stored = await loadRun(id, 'summary');
        expect(stored!.steps.a).toStrictEqual(summarizeStepResult(result as any));
        expect(Object.keys(stored!.steps.a!)).not.toContain('resumedAt');
      });

      it('summarizes the latest result of each step', async () => {
        const id = runId();
        const running = { status: 'running', payload: { p: 1 }, startedAt: 1 };
        await checkpoint(id, makeSnapshot(id, { context: { a: ok(1), b: running } }));
        await append(id, makeSnapshot(id, { context: { a: { status: 'failed', error: 'x' }, b: ok(2) } }), ['a', 'b']);

        const stored = await loadRun(id, 'summary');
        expect(stored!.summarizedStepIds).toEqual(['b']);
        expect(stored!.steps).toEqual({
          a: { status: 'failed', error: 'x' },
          b: { status: 'success', startedAt: 1, endedAt: 2 },
        });
      });

      it('loads the latest result of the given steps only', async () => {
        const id = runId();
        await checkpoint(id, makeSnapshot(id, { context: { a: ok(1), b: ok(2) } }));
        await append(id, makeSnapshot(id, { context: { a: ok(10) } }), ['a']);

        expect(await store.loadWorkflowRunSteps({ workflowName, runId: id, stepIds: ['a', 'missing'] })).toEqual({
          a: ok(10),
        });
        expect(await store.loadWorkflowRunSteps({ workflowName, runId: id, stepIds: [] })).toEqual({});
        expect(await store.loadWorkflowRunSteps({ workflowName, runId: 'nope', stepIds: ['a'] })).toEqual({});
      });

      it('loads the header without the entries, and only for v2 runs', async () => {
        const id = runId();
        await checkpoint(id, makeSnapshot(id, { context: { a: ok(1) } }));
        await store.persistWorkflowSnapshot({ workflowName, runId: 'v1', snapshot: makeSnapshot('v1') });

        expect(await store.loadWorkflowRunHeader({ workflowName, runId: id })).toEqual({
          header: makeHeader(id),
          lastSeq: 2,
          startStateSeq: 2,
        });
        expect(await store.loadWorkflowRunHeader({ workflowName, runId: 'v1' })).toBeNull();
        expect(await store.loadWorkflowRunHeader({ workflowName, runId: 'nope' })).toBeNull();
        expect(await store.loadWorkflowRun({ workflowName, runId: 'v1', successfulSteps: 'full' })).toBeNull();
        expect(await store.loadWorkflowRunSteps({ workflowName, runId: 'v1', stepIds: ['a'] })).toEqual({});
      });
    });

    describe('state patches', () => {
      const set = (path: (string | number)[], value: unknown) => ({ op: 'set' as const, path, value });
      const bytes = (...ops: unknown[][]) => ops.reduce((sum: number, o) => sum + JSON.stringify(o).length, 0);

      // A parent, child and grandchild run, sharing a run id as nested runs do.
      const family = () => {
        const id = runId();
        const run = (name: string) => ({ workflowName: `${workflowName}-${name}`, runId: id });
        const childOf = (name: string) =>
          makeHeader(id, { parentWorkflow: { workflowId: `${workflowName}-${name}`, runId: id, stepId: 'nested' } });
        return {
          run,
          parent: run('parent'),
          child: run('child'),
          grandchild: run('grandchild'),
          header: makeHeader(id),
          childOf,
        };
      };

      /** The state every reader returns for a run, which must agree. */
      async function statesOf(run: { workflowName: string; runId: string }) {
        const loaded = await store.loadWorkflowRun({ ...run, successfulSteps: 'summary' });
        const snapshot = await store.loadWorkflowSnapshot(run);
        const byId = await store.getWorkflowRunById(run);
        const listed = (await store.listWorkflowRuns({ workflowName: run.workflowName })).runs[0];
        for (const other of [snapshot!.value, parsed(byId!).value, parsed(listed!).value]) {
          expect(other).toEqual(loaded!.state);
        }
        return loaded!;
      }

      it('applies every patch after the latest full state, in order, ignoring earlier ones', async () => {
        const { parent, header } = family();
        const early = [set(['a'], 'ignored')];
        const p1 = [set(['list', 1], 'y'), { op: 'delete' as const, path: ['gone'] }];
        const p2 = [set(['n'], 2)];
        await store.writeWorkflowRunCheckpoint({ ...parent, header, steps: {}, state: { a: 0 } });
        await store.appendWorkflowRunEntries({ ...parent, header, steps: {}, statePatch: early });
        await store.appendWorkflowRunEntries({
          ...parent,
          header,
          steps: {},
          state: { n: 1, list: ['x'], gone: true },
        });
        await store.appendWorkflowRunEntries({ ...parent, header, steps: { a: ok(1) }, statePatch: p1 });
        await store.appendWorkflowRunEntries({ ...parent, header, steps: {}, statePatch: p2 });

        const loaded = await statesOf(parent);
        expect(loaded.state).toEqual({ n: 2, list: ['x', 'y'] });
        expect(loaded.statePatchBytes).toBe(bytes(p1, p2));
        expect(loaded.lastSeq).toBe(6);
        // Rebuilding doesn't touch the stored entries.
        expect((await statesOf(parent)).state).toEqual({ n: 2, list: ['x', 'y'] });
      });

      it('stores a checkpoint as a version of another run plus a patch', async () => {
        const { parent, child, header, childOf } = family();
        const { lastSeq } = await store.writeWorkflowRunCheckpoint({ ...parent, header, steps: {}, state: { p: 1 } });
        await store.writeWorkflowRunCheckpoint({
          ...child,
          header: childOf('parent'),
          steps: {},
          stateBase: { ...parent, seq: lastSeq },
          statePatch: [set(['n'], 1)],
        });
        const loaded = await statesOf(child);
        expect(loaded.state).toEqual({ p: 1, n: 1 });
        // Only the run's own patches count.
        expect(loaded.statePatchBytes).toBe(bytes([set(['n'], 1)]));

        // Without a base, a checkpoint patch applies to an empty state.
        await store.writeWorkflowRunCheckpoint({ ...parent, header, steps: {}, statePatch: [set(['o'], 1)] });
        expect((await statesOf(parent)).state).toEqual({ o: 1 });
      });

      it("starts a run from another run's state version, recursively", async () => {
        const { parent, child, grandchild, header, childOf } = family();
        await store.writeWorkflowRunCheckpoint({ ...parent, header, steps: {}, state: { p: 1, list: [1] } });
        const { lastSeq: parentSeq } = await store.appendWorkflowRunEntries({
          ...parent,
          header,
          steps: {},
          statePatch: [set(['p'], 2)],
        });
        await store.writeWorkflowRunCheckpoint({
          ...child,
          header: childOf('parent'),
          steps: { input: {} as any },
          stateBase: { ...parent, seq: parentSeq },
        });
        expect((await statesOf(child)).state).toEqual({ p: 2, list: [1] });

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

        const loadedChild = await statesOf(child);
        expect(loadedChild.state).toEqual({ p: 2, list: [1, 2] });
        expect(loadedChild.statePatchBytes).toBe(bytes(c1));
        const loadedGrandchild = await statesOf(grandchild);
        expect(loadedGrandchild.state).toEqual({ p: 2, list: [1, 2], g: true });
        expect(loadedGrandchild.statePatchBytes).toBe(bytes(g1));
        // The parent's state is untouched by its children's patches.
        expect((await statesOf(parent)).state).toEqual({ p: 2, list: [1] });
        // Patching the header rebuilds the same state.
        const updated = await store.updateWorkflowState({ ...grandchild, opts: { status: 'canceled' } });
        expect(updated!.value).toEqual({ p: 2, list: [1, 2], g: true });
      });

      it("keeps reading the version it was built on after the other run's state moves on or starts over", async () => {
        const { parent, child, header, childOf } = family();
        const { lastSeq } = await store.writeWorkflowRunCheckpoint({
          ...parent,
          header,
          steps: { a: ok(1) },
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
        await store.appendWorkflowRunEntries({ ...parent, header, steps: {}, state: { list: ['x'] } });
        expect((await statesOf(child)).state).toEqual({ list: ['a', 'b', 'c', 'd'] });
        await store.writeWorkflowRunCheckpoint({ ...parent, header, steps: { b: ok(2) }, state: { other: 1 } });
        expect((await statesOf(child)).state).toEqual({ list: ['a', 'b', 'c', 'd'] });
        // The checkpoint still replaces the parent's own steps and state.
        expect(await store.loadWorkflowRun({ ...parent, successfulSteps: 'full' })).toMatchObject({
          steps: { b: ok(2) },
          state: { other: 1 },
          statePatchBytes: 0,
        });
        expect(Object.keys((await store.loadWorkflowRun({ ...parent, successfulSteps: 'full' }))!.steps)).toEqual([
          'b',
        ]);

        // A full state replaces the base.
        await store.appendWorkflowRunEntries({ ...child, header: childOf('parent'), steps: {}, state: { own: true } });
        expect((await statesOf(child)).state).toEqual({ own: true });
      });

      it('starts from an empty state when the base run is not stored, or the checkpoint has no state', async () => {
        const { parent, child, header, childOf } = family();
        await store.writeWorkflowRunCheckpoint({
          ...child,
          header: childOf('missing'),
          steps: {},
          stateBase: { workflowName: `${workflowName}-missing`, runId: child.runId, seq: 3 },
        });
        await store.appendWorkflowRunEntries({
          ...child,
          header: childOf('missing'),
          steps: {},
          statePatch: [set(['c'], 1)],
        });
        expect((await statesOf(child)).state).toEqual({ c: 1 });

        await store.appendWorkflowRunEntries({ ...parent, header, steps: {}, state: { p: 1 } });
        await store.writeWorkflowRunCheckpoint({ ...parent, header, steps: {} });
        expect((await statesOf(parent)).state).toEqual({});
      });

      it("serves a run's drafts to runs built on them, and leaves them out of the run's own state", async () => {
        const { run, parent, header, childOf } = family();
        const { lastSeq } = await store.writeWorkflowRunCheckpoint({
          ...parent,
          header,
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
        expect([d1.seq, d2.seq, full.seq, d3.seq]).toEqual([lastSeq + 1, lastSeq + 2, lastSeq + 3, lastSeq + 4]);

        const children = { c1: d1.seq, c2: d2.seq, c3: d3.seq };
        for (const [name, seq] of Object.entries(children)) {
          await store.writeWorkflowRunCheckpoint({
            ...run(name),
            header: childOf('parent'),
            steps: {},
            stateBase: { ...parent, seq, draft: true },
          });
        }
        const expected = { c1: { list: ['a', 'b'] }, c2: { list: ['a', 'b', 'c'] }, c3: { list: ['z'], n: 1 } };
        for (const [name, state] of Object.entries(expected)) {
          expect((await statesOf(run(name))).state).toEqual(state);
        }

        // Drafts never change the run's own state, so a restart reads the stored one.
        const loaded = await statesOf(parent);
        expect(loaded.state).toEqual({ list: ['a'] });
        expect(loaded.statePatchBytes).toBe(0);
        expect(loaded.lastSeq).toBe(d3.seq);
        // A later state patch applies to the stored state, not to a draft.
        await store.appendWorkflowRunEntries({ ...parent, header, steps: {}, statePatch: [set(['m'], 1)] });
        expect((await statesOf(parent)).state).toEqual({ list: ['a'], m: 1 });

        // A checkpoint keeps the drafts the runs built on them read.
        await store.writeWorkflowRunCheckpoint({ ...parent, header, steps: {}, state: { fresh: true } });
        expect((await statesOf(parent)).state).toEqual({ fresh: true });
        for (const [name, state] of Object.entries(expected)) {
          expect((await statesOf(run(name))).state).toEqual(state);
        }
      });

      it('fails a draft of a run that is not stored', async () => {
        const { parent } = family();
        await expect(store.appendWorkflowRunStateDraft({ ...parent, state: {} })).rejects.toThrow();
      });

      it('keeps the state of the runs built on a deleted run', async () => {
        const { run, parent, child, grandchild, header, childOf } = family();
        const sibling = run('sibling');
        const { lastSeq } = await store.writeWorkflowRunCheckpoint({
          ...parent,
          header,
          steps: {},
          state: { list: ['a'] },
        });
        const draft = await store.appendWorkflowRunStateDraft({
          ...parent,
          on: { seq: lastSeq },
          ops: [set(['list', 1], 'b')],
        });
        const c1 = [set(['c'], 1)];
        await store.writeWorkflowRunCheckpoint({
          ...child,
          header: childOf('parent'),
          steps: {},
          stateBase: { ...parent, seq: lastSeq },
          statePatch: c1,
        });
        const { lastSeq: siblingSeq } = await store.writeWorkflowRunCheckpoint({
          ...sibling,
          header: childOf('parent'),
          steps: {},
          stateBase: { ...parent, seq: draft.seq, draft: true },
        });
        await store.writeWorkflowRunCheckpoint({
          ...grandchild,
          header: childOf('sibling'),
          steps: {},
          stateBase: { ...sibling, seq: siblingSeq },
        });

        await store.deleteWorkflowRunById(parent);
        expect(await store.loadWorkflowRun({ ...parent, successfulSteps: 'full' })).toBeNull();
        const loadedChild = await statesOf(child);
        expect(loadedChild.state).toEqual({ list: ['a'], c: 1 });
        expect(loadedChild.statePatchBytes).toBe(bytes(c1));
        expect((await statesOf(sibling)).state).toEqual({ list: ['a', 'b'] });
        expect((await statesOf(grandchild)).state).toEqual({ list: ['a', 'b'] });
        // A run recreated under the deleted key starts its seq over without changing them.
        await store.writeWorkflowRunCheckpoint({ ...parent, header, steps: {}, state: { other: 1 } });
        expect((await statesOf(child)).state).toEqual({ list: ['a'], c: 1 });
        expect((await statesOf(sibling)).state).toEqual({ list: ['a', 'b'] });
      });
    });

    describe('patches', () => {
      it('patches the header with compare-and-set, without writing an entry', async () => {
        const id = runId();
        await checkpoint(id, makeSnapshot(id, { context: { a: ok(1) } }));
        await store.persistWorkflowSnapshot({ workflowName, runId: 'v1', snapshot: makeSnapshot('v1') });

        expect(
          await store.updateWorkflowRunHeader({
            workflowName,
            runId: id,
            opts: { status: 'canceled', expectedStatus: 'suspended' },
          }),
        ).toBeUndefined();
        expect((await store.loadWorkflowRunHeader({ workflowName, runId: id }))!.header.status).toBe('running');

        const updated = await store.updateWorkflowRunHeader({
          workflowName,
          runId: id,
          opts: { status: 'canceled', expectedStatus: 'running', suspendedPaths: { a: [0] } },
        });
        expect(updated).toEqual({
          header: makeHeader(id, { status: 'canceled', suspendedPaths: { a: [0] } }),
          lastSeq: 2,
          startStateSeq: 2,
        });
        expect(await store.loadWorkflowRunHeader({ workflowName, runId: id })).toEqual(updated);
        expect((await loadRun(id))!.steps).toEqual({ a: ok(1) });

        expect(
          await store.updateWorkflowRunHeader({ workflowName, runId: 'v1', opts: { status: 'success' } }),
        ).toBeUndefined();
        expect(await store.updateWorkflowRunHeader({ workflowName, runId: 'nope', opts: { status: 'success' } })).toBe(
          undefined,
        );
        expect((await load('v1'))!.status).toBe('running');
      });

      it('patches through updateWorkflowState, and returns the rebuilt run', async () => {
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
        await store.persistWorkflowSnapshot({ workflowName, runId: 'r1', snapshot: makeSnapshot('r1') });
        await tick();
        await checkpoint('r2', makeSnapshot('r2', { context: { a: ok(2) } }));
        await tick();
        await store.persistWorkflowSnapshot({ workflowName, runId: 'r3', snapshot: makeSnapshot('r3') });
        await tick();
        await checkpoint('r4', makeSnapshot('r4', { context: { a: ok(4) } }));

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
        await checkpoint('a', makeSnapshot('a', { status: 'suspended' }), { resourceId });
        await tick();
        await checkpoint('b', makeSnapshot('b', { status: 'success' }));
        await tick();
        await checkpoint('c', makeSnapshot('c', { status: 'suspended' }));
        const createdB = (await store.getWorkflowRunById({ workflowName, runId: 'b' }))!.createdAt;

        const ids = async (filter: Record<string, any>) =>
          (await store.listWorkflowRuns({ workflowName, ...filter })).runs.map(r => r.runId);

        expect(await ids({ status: 'suspended' })).toEqual(['c', 'a']);
        expect(await ids({ resourceId })).toEqual(['a']);
        expect(await ids({ fromDate: createdB })).toEqual(['c', 'b']);
        expect(await ids({ toDate: createdB })).toEqual(['b', 'a']);
        expect(await ids({ fromDate: createdB, toDate: createdB })).toEqual(['b']);
        expect((await store.listWorkflowRuns({ resourceId })).runs.map(r => r.runId)).toEqual(['a']);

        // A patched status is what the filter sees.
        await store.updateWorkflowRunHeader({ workflowName, runId: 'b', opts: { status: 'suspended' } });
        expect(await ids({ status: 'suspended' })).toEqual(['c', 'b', 'a']);
      });

      it('includes v2 runs in threadId filters, including a thread an append added', async () => {
        const threadId = `thread-${randomUUID()}`;
        const durable = createSampleSuspendedSnapshotWithThread({ threadId, layout: 'durable' });
        await checkpoint(durable.runId, durable.snapshot);

        // The thread first appears with an append, as when an agent step suspends.
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
        expect(await loadRun('v2-run')).toBeNull();
        expect(await store.loadWorkflowRunSteps({ workflowName, runId: 'v2-run', stepIds: ['a'] })).toEqual({});
        expect((await store.listWorkflowRuns({ workflowName })).runs.map(r => r.runId)).toEqual(['other']);

        // A run written again after its deletion holds only the new entries.
        await append('v2-run', makeSnapshot('v2-run', { context: { b: ok(2) } }), ['b']);
        expect(await loadRun('v2-run')).toMatchObject({ lastSeq: 1, steps: { b: ok(2) } });
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
        await rejected(append(id, changed, ['a', 'b'], true, { fence }));
        await rejected(checkpoint(id, changed, { fence }));
        await rejected(store.updateWorkflowRunHeader({ workflowName, runId: id, opts: { status: 'canceled' }, fence }));
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
        expect((await loadRun(id))!.lastSeq).toBe(2);

        const fresh = runId();
        const claimFresh = await store.claimRunOwnership({ runId: fresh, ownerId: 'a', leaseMs: 60_000 });
        await store.claimRunOwnership({ runId: fresh, ownerId: 'b', leaseMs: 60_000, force: true });
        const staleFresh = { runId: fresh, ownerId: 'a', generation: claimFresh.record!.generation };
        await rejected(checkpoint(fresh, makeSnapshot(fresh), { fence: staleFresh }));
        await rejected(append(fresh, makeSnapshot(fresh), [], false, { fence: staleFresh }));
        expect(await load(fresh)).toBeNull();
      });
    });
  });
}
