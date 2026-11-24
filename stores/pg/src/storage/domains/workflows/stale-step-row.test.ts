import type { WorkflowsStorage, WorkflowRunHeader } from '@mastra/core/storage';
import type { StepResult, WorkflowRunState } from '@mastra/core/workflows';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgresStore } from '../..';
import { TEST_CONFIG } from '../../test-utils';

const ok = (output: unknown) =>
  ({ status: 'success', output, payload: {}, startedAt: 1, endedAt: 2 }) as StepResult<any, any, any, any>;

const header = (runId: string): WorkflowRunHeader =>
  ({
    runId,
    status: 'running',
    activePaths: [],
    activeStepsPath: {},
    suspendedPaths: {},
    resumeLabels: {},
    serializedStepGraph: [],
    waitingPaths: {},
    timestamp: 1,
  }) as unknown as WorkflowRunHeader;

/**
 * Two appends of the same step racing on the run can leave the step's pre-rewrite row behind: the
 * later append's delete runs on the statement's snapshot, taken before it waited for the run row
 * lock, so a row the lock holder committed in the meantime isn't seen (see `appendEntriesSql`).
 * This pins what the `loadWorkflowRunSteps` contract promises about such a leftover row: latest
 * reads ignore it, a read bounded at a seq at or past it returns the step's stale result as of the
 * bound, and the step's next write deletes it while keeping the step's first-write position.
 */
describe('Postgres storage v2 stale step row left by a concurrent same-step append', () => {
  const schemaName = `stale_step_${Date.now()}`;
  const workflowName = 'wf-stale-step';
  const runId = 'run-stale-step';
  let pgStore: PostgresStore;
  let store: WorkflowsStorage;

  beforeAll(async () => {
    pgStore = new PostgresStore({ ...TEST_CONFIG, id: 'stale-step-row', schemaName });
    await pgStore.init();
    store = (await pgStore.getStore('workflows'))!;
  });

  afterAll(async () => {
    await pgStore.db.none(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
    await pgStore.close();
  });

  it('latest reads ignore the leftover, bounded reads return it, and the next write sweeps it', async () => {
    const run = { workflowName, runId };
    // a@1, state@2, b@3, then a rewritten at 4 (deleting a@1, first_seq 1).
    await store.writeWorkflowRunCheckpoint({
      ...run,
      header: header(runId),
      steps: { a: ok('old') } as WorkflowRunState['context'],
      state: {},
    });
    await store.appendWorkflowRunEntries({ ...run, header: header(runId), steps: { b: ok('b') } });
    await store.appendWorkflowRunEntries({ ...run, header: header(runId), steps: { a: ok('new') } });

    // The row a racing writer leaves behind: the step's pre-rewrite entry, below the rewrite's seq.
    await pgStore.db.none(
      `INSERT INTO "${schemaName}".mastra_workflow_run_entries (workflow_name, run_id, seq, kind, step_id, payload)
       VALUES ($1, $2, 1, 'step', 'a', $3)`,
      [workflowName, runId, JSON.stringify(ok('old'))],
    );

    // Latest reads take the newest entry per step, so the leftover changes nothing.
    expect(await store.loadWorkflowRunSteps({ ...run, stepIds: ['a', 'b'] })).toEqual({ a: ok('new'), b: ok('b') });
    expect(await store.loadWorkflowRunStep({ ...run, stepId: 'a' })).toMatchObject({ steps: { a: ok('new') } });
    expect((await store.loadWorkflowRun({ ...run, successfulSteps: 'full' }))!.steps.a).toEqual(ok('new'));

    // A read bounded between the leftover and the rewrite returns the stale result as of the
    // bound: the step's presence doesn't prove it wasn't written again after the bound.
    expect(await store.loadWorkflowRunSteps({ ...run, stepIds: ['a', 'b'], upToSeq: 3 })).toEqual({
      a: ok('old'),
      b: ok('b'),
    });

    // The step's next write deletes the leftover too, and the step keeps its first-write position.
    await store.appendWorkflowRunEntries({ ...run, header: header(runId), steps: { a: ok('final') } });
    const rows = await pgStore.db.manyOrNone<{ seq: number; first_seq: number | null }>(
      `SELECT seq, first_seq FROM "${schemaName}".mastra_workflow_run_entries
       WHERE workflow_name = $1 AND run_id = $2 AND kind = 'step' AND step_id = 'a'`,
      [workflowName, runId],
    );
    expect(rows).toEqual([{ seq: 5, first_seq: 1 }]);
    expect(await store.loadWorkflowRunSteps({ ...run, stepIds: ['a', 'b'], upToSeq: 3 })).toEqual({ b: ok('b') });
    // `context` keys keep their first-write order: a before b.
    expect(Object.keys((await store.loadWorkflowRun({ ...run, successfulSteps: 'full' }))!.steps)).toEqual(['a', 'b']);
  });
});
