import type { WorkflowRun, WorkflowsStorage } from '@mastra/core/storage';
import type { WorkflowRunState, WorkflowRunStatus } from '@mastra/core/workflows';
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';

/** A stored run's snapshot; `timestamp: undefined` leaves the key out. */
const runSnapshot = (status: WorkflowRunStatus, timestamp: number | undefined, extra: Record<string, unknown> = {}) => {
  const snapshot: Record<string, unknown> = {
    runId: `run-${randomUUID()}`,
    status,
    value: { counter: 1 },
    context: {
      input: { started: true },
      'step-a': { status: 'success', output: { result: 'a' }, payload: {}, startedAt: 1, endedAt: 2 },
    },
    serializedStepGraph: [],
    activePaths: [],
    activeStepsPath: {},
    suspendedPaths: {},
    resumeLabels: {},
    waitingPaths: {},
    ...extra,
  };
  if (timestamp !== undefined) {
    snapshot.timestamp = timestamp;
  }

  return snapshot as unknown as WorkflowRunState;
};

const parsed = (run: WorkflowRun) =>
  (typeof run.snapshot === 'string' ? JSON.parse(run.snapshot) : run.snapshot) as WorkflowRunState;

/**
 * Conformance cases for listing active runs in summary mode, which run recovery reads on every
 * pass, so it must not load each run's step results. Registered inside "Run fencing: workflows"
 * because recovery only runs on stores with run fencing, and the suite runs on all of them.
 */
export function createSummaryListingTests(getWorkflows: () => WorkflowsStorage) {
  describe('summary listing', () => {
    it('lists runs by status with only status, timestamp and parent, and full snapshots without summary', async ctx => {
      const workflows = getWorkflows();
      if (!(await workflows.supportsRunFencing())) {
        return ctx.skip();
      }

      const workflowName = `wf-${randomUUID()}`;
      const resourceId = `resource-${randomUUID()}`;
      const parent = { workflowId: 'parent-workflow', runId: `run-${randomUUID()}` };
      const nestedParent = { ...parent, stepId: 'nested-step', foreachIndex: 0 };

      // Each stored snapshot with the summary it must list as. A parent counts only with both IDs,
      // and a missing field is left out rather than returned as null.
      const runs: Array<{ snapshot: WorkflowRunState; summary: Record<string, unknown>; resourceId?: string }> = [
        { snapshot: runSnapshot('running', 1_000), summary: { status: 'running', timestamp: 1_000 }, resourceId },
        {
          snapshot: runSnapshot('running', 2_000, { parentWorkflow: nestedParent }),
          summary: { status: 'running', timestamp: 2_000, parentWorkflow: parent },
        },
        {
          snapshot: runSnapshot('waiting', 3_000, { parentWorkflow: nestedParent }),
          summary: { status: 'waiting', timestamp: 3_000, parentWorkflow: parent },
        },
        { snapshot: runSnapshot('success', 4_000), summary: { status: 'success', timestamp: 4_000 } },
        {
          snapshot: runSnapshot('running', 5_000, { parentWorkflow: null }),
          summary: { status: 'running', timestamp: 5_000 },
        },
        {
          snapshot: runSnapshot('running', 6_000, { parentWorkflow: { runId: parent.runId } }),
          summary: { status: 'running', timestamp: 6_000 },
        },
        { snapshot: runSnapshot('running', undefined), summary: { status: 'running' } },
      ];
      for (const { snapshot, resourceId: runResourceId } of runs) {
        await workflows.persistWorkflowSnapshot({
          workflowName,
          runId: snapshot.runId,
          snapshot,
          ...(runResourceId ? { resourceId: runResourceId } : {}),
        });
      }

      // Storage v2 keeps the parent in the run's header rather than in a snapshot.
      if (workflows.supportsRunJournal()) {
        for (const run of [
          { snapshot: runSnapshot('running', 7_000), summary: { status: 'running', timestamp: 7_000 } },
          {
            snapshot: runSnapshot('running', 8_000, { parentWorkflow: nestedParent }),
            summary: { status: 'running', timestamp: 8_000, parentWorkflow: parent },
          },
          {
            snapshot: runSnapshot('running', 9_000, { parentWorkflow: { runId: parent.runId } }),
            summary: { status: 'running', timestamp: 9_000 },
          },
        ]) {
          const { context, value, ...header } = run.snapshot;
          await workflows.writeWorkflowRunCheckpoint({
            workflowName,
            runId: run.snapshot.runId,
            header,
            steps: context,
            state: value,
          });
          runs.push(run);
        }
      }

      for (const status of ['running', 'waiting'] as const) {
        const summary = await workflows.listWorkflowRuns({ workflowName, status, perPage: false, summary: true });
        const full = await workflows.listWorkflowRuns({ workflowName, status, perPage: false });

        // toStrictEqual also fails on a `parentWorkflow: undefined` or `null` key.
        expect(Object.fromEntries(summary.runs.map(run => [run.runId, parsed(run)]))).toStrictEqual(
          Object.fromEntries(
            runs.filter(run => run.snapshot.status === status).map(run => [run.snapshot.runId, run.summary]),
          ),
        );
        expect(summary.total).toBe(full.total);

        // Runs created in the same millisecond may come back in either order.
        const withoutSnapshot = (list: WorkflowRun[]) =>
          list.map(({ snapshot: _snapshot, ...rest }) => rest).sort((a, b) => a.runId.localeCompare(b.runId));
        expect(withoutSnapshot(summary.runs)).toEqual(withoutSnapshot(full.runs));

        for (const run of full.runs) {
          const stored = runs.find(({ snapshot }) => snapshot.runId === run.runId)!.snapshot;
          expect(parsed(run).context).toEqual(stored.context);
          expect(parsed(run).parentWorkflow).toEqual(stored.parentWorkflow);
        }
      }

      // toEqual above treats a missing resourceId like an undefined one, so check it by key.
      const { runs: running } = await workflows.listWorkflowRuns({
        workflowName,
        status: 'running',
        perPage: false,
        summary: true,
      });
      expect(running.find(run => run.runId === runs[0]!.snapshot.runId)).toHaveProperty('resourceId', resourceId);
    });
  });
}
