import type { WorkflowsStorage } from '../storage/domains/workflows/base';
import type { WorkflowRun } from '../storage/types';
import type { WorkflowRunStatus } from '../workflows/types';

/** Runs the recovery sweep handles per batch, and so the size of each ownership read. */
const PAGE_SIZE = 100;

const ACTIVE_STATUSES: WorkflowRunStatus[] = ['running', 'waiting'];

/**
 * Yields the `running` and `waiting` runs of one workflow in batches of at
 * most a hundred, each run once.
 *
 * Each status is listed in one call. Paged reads cost more on the SQL and
 * document stores, whose paged `listWorkflowRuns` also counts the matches,
 * and offset pages skip runs that leave the status filter mid-sweep.
 */
export async function* activeWorkflowRunPages({
  store,
  workflowName,
}: {
  store: WorkflowsStorage;
  workflowName: string;
}): AsyncGenerator<WorkflowRun[]> {
  // Shared by both statuses: a run that moves between them while the sweep runs is listed under each.
  const seen = new Set<string>();

  for (const status of ACTIVE_STATUSES) {
    const { runs } = await store.listWorkflowRuns({ workflowName, status, perPage: false });
    const unseen: WorkflowRun[] = [];
    for (const run of runs) {
      if (!seen.has(run.runId)) {
        seen.add(run.runId);
        unseen.push(run);
      }
    }

    for (let start = 0; start < unseen.length; start += PAGE_SIZE) {
      yield unseen.slice(start, start + PAGE_SIZE);
    }
  }
}
