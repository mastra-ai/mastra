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
 *
 * Both statuses are listed before the first batch is yielded. Listing
 * `waiting` only after every `running` batch was restarted would miss a run
 * that moved from `waiting` to `running` in between.
 */
export async function* activeWorkflowRunPages({
  store,
  workflowName,
}: {
  store: WorkflowsStorage;
  workflowName: string;
}): AsyncGenerator<WorkflowRun[]> {
  const listings = await Promise.all(
    ACTIVE_STATUSES.map(status => store.listWorkflowRuns({ workflowName, status, perPage: false })),
  );

  // Shared by both statuses: a run that moved between them while they were listed is listed under each.
  const seen = new Set<string>();

  for (const { runs } of listings) {
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
