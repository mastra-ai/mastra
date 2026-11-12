import type { WorkflowRun, WorkflowsStorage } from '@mastra/core/storage';
import type { WorkflowRunState, WorkflowRunStatus } from '@mastra/core/workflows';
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';

const runSnapshot = (
  runId: string,
  status: WorkflowRunStatus,
  timestamp: number,
  extra: Record<string, unknown> = {},
) =>
  ({
    runId,
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
    timestamp,
    ...extra,
  }) as unknown as WorkflowRunState;

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
      const parent = { workflowId: 'parent-workflow', runId: `run-${randomUUID()}` };
      const nestedParent = { ...parent, stepId: 'nested-step', foreachIndex: 0 };

      const runs = [
        runSnapshot(`run-${randomUUID()}`, 'running', 1_000),
        runSnapshot(`run-${randomUUID()}`, 'running', 2_000, { parentWorkflow: nestedParent }),
        runSnapshot(`run-${randomUUID()}`, 'waiting', 3_000, { parentWorkflow: nestedParent }),
        runSnapshot(`run-${randomUUID()}`, 'success', 4_000),
      ];
      for (const snapshot of runs) {
        await workflows.persistWorkflowSnapshot({ workflowName, runId: snapshot.runId, snapshot });
      }

      // Storage v2 keeps the parent in the run's header rather than in a snapshot.
      if (workflows.supportsRunJournal()) {
        for (const snapshot of [
          runSnapshot(`run-${randomUUID()}`, 'running', 5_000),
          runSnapshot(`run-${randomUUID()}`, 'running', 6_000, { parentWorkflow: nestedParent }),
        ]) {
          const { context, value, ...header } = snapshot;
          await workflows.writeWorkflowRunCheckpoint({
            workflowName,
            runId: snapshot.runId,
            header,
            steps: context,
            state: value,
          });
          runs.push(snapshot);
        }
      }

      const expectedSummary = (status: WorkflowRunStatus) =>
        Object.fromEntries(
          runs
            .filter(snapshot => snapshot.status === status)
            .map(snapshot => [
              snapshot.runId,
              snapshot.parentWorkflow
                ? { status, timestamp: snapshot.timestamp, parentWorkflow: parent }
                : { status, timestamp: snapshot.timestamp },
            ]),
        );

      for (const status of ['running', 'waiting'] as const) {
        const summary = await workflows.listWorkflowRuns({ workflowName, status, perPage: false, summary: true });
        const full = await workflows.listWorkflowRuns({ workflowName, status, perPage: false });

        // toStrictEqual also fails on a `parentWorkflow: undefined` or `null` key.
        expect(Object.fromEntries(summary.runs.map(run => [run.runId, parsed(run)]))).toStrictEqual(
          expectedSummary(status),
        );
        expect(summary.total).toBe(full.total);

        // Runs created in the same millisecond may come back in either order.
        const withoutSnapshot = (list: WorkflowRun[]) =>
          list.map(({ snapshot: _snapshot, ...rest }) => rest).sort((a, b) => a.runId.localeCompare(b.runId));
        expect(withoutSnapshot(summary.runs)).toEqual(withoutSnapshot(full.runs));

        for (const run of full.runs) {
          const stored = runs.find(snapshot => snapshot.runId === run.runId)!;
          expect(parsed(run).context).toEqual(stored.context);
          expect(parsed(run).parentWorkflow).toEqual(stored.parentWorkflow);
        }
      }
    });
  });
}
