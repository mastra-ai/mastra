import { describe, expect, it } from 'vitest';
import type { WorkflowRunState } from '../../../workflows';
import { InMemoryDB } from '../inmemory-db';
import { WorkflowsInMemory } from './inmemory';
import { materializeWorkflowRun } from './journal';

// Store-agnostic storage v2 cases live in the shared conformance suite
// (stores/_test-utils, `createRunJournalTests`). These check the in-memory layout.

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

  it('numbers entries in write order, continuing across checkpoints', async () => {
    const { db, store } = setup();
    const context: Record<string, any> = { input: {}, a: ok(1) };
    const snapshot = makeSnapshot('r1', { context });
    await store.persistWorkflowSnapshot({ workflowName: 'wf', runId: 'r1', snapshot, storageVersion: 2 });

    context.b = ok(2);
    await store.persistWorkflowSnapshot({
      workflowName: 'wf',
      runId: 'r1',
      snapshot,
      storageVersion: 2,
      changes: { stepIds: ['b'], state: true },
    });
    expect(db.workflowRunEntries.get('wf-r1')!.map(e => e.seq)).toEqual([1, 2, 3, 4, 5]);

    await store.persistWorkflowSnapshot({
      workflowName: 'wf',
      runId: 'r1',
      snapshot: makeSnapshot('r1', { context: { input: {} } as any }),
      storageVersion: 2,
    });
    expect(db.workflowRunEntries.get('wf-r1')!.map(e => e.seq)).toEqual([6, 7]);
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
