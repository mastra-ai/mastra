import { randomUUID } from 'node:crypto';
import type { WorkflowRunHeader, WorkflowsStorage } from '@mastra/core/storage';
import { STATE_CHECKPOINT_PATCHES } from '@mastra/core/storage';
import type { StepResult } from '@mastra/core/workflows';
import { expect, it } from 'vitest';

const header = (runId: string) =>
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

const set = (path: string[], value: unknown) => ({ op: 'set' as const, path, value });

/**
 * The storage v2 runs table that `@mastra/pg` 1.36.0-alpha.0 and `@mastra/libsql` 1.30.0-alpha.0
 * created has no `stateSeq`, `statePatchCount`, `statePatchBytes` or `stateBytes` column. A run
 * stored by them must keep saving and loading once `init` of a later version has run.
 */
export function createRunsTableUpgradeTests({
  openStore,
  dropStateColumns,
}: {
  /** A new store on the same database, initialized, as after a restart. */
  openStore: () => Promise<WorkflowsStorage>;
  /** Drop the four state columns from the runs table, leaving its rows. */
  dropStateColumns: () => Promise<void>;
}) {
  it('keeps saving and loading a storage v2 run stored before the state columns existed', async () => {
    const run = { workflowName: `wf-${randomUUID()}`, runId: `run-${randomUUID()}` };
    const step = { status: 'success', output: 1, payload: {}, startedAt: 1, endedAt: 2 } as StepResult<
      any,
      any,
      any,
      any
    >;
    // Large enough that only the patch count decides when a full state is written.
    const pad = 'x'.repeat(10_000);

    const before = await openStore();
    await before.writeWorkflowRunCheckpoint({
      ...run,
      header: header(run.runId),
      steps: { a: step },
      state: { pad, n: 0 },
    });
    await before.appendWorkflowRunEntries({ ...run, steps: {}, statePatch: [set(['n'], 1)] });
    await dropStateColumns();

    const after = await openStore();
    // The columns start at zero for this run, so the full state comes after this many more patches.
    const last = STATE_CHECKPOINT_PATCHES + 2;
    for (let n = 2; n <= last; n++) {
      await after.appendWorkflowRunEntries({ ...run, steps: {}, statePatch: [set(['n'], n)] });
    }

    expect(await after.loadWorkflowRun({ ...run, successfulSteps: 'full' })).toMatchObject({
      steps: { a: { status: 'success', output: 1 } },
      state: { pad, n: last },
    });
    expect(await after.loadWorkflowRunHeader(run)).toMatchObject({
      statePatchCount: 1,
      stateBytes: JSON.stringify({ pad, n: last - 1 }).length,
    });

    const fresh = { ...run, runId: `run-${randomUUID()}` };
    await after.writeWorkflowRunCheckpoint({ ...fresh, header: header(fresh.runId), steps: {}, state: { n: 0 } });
    await after.appendWorkflowRunEntries({ ...fresh, steps: {}, statePatch: [set(['n'], 1)] });
    expect((await after.loadWorkflowRun({ ...fresh, successfulSteps: 'full' }))?.state).toEqual({ n: 1 });
  });
}
