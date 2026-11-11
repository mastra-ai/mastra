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
 * Each status is listed in one call. Paging through a status filter would
 * cost more on every SQL and document store, whose paged `listWorkflowRuns`
 * also counts the matches, and offset pages skip runs that leave the filter
 * mid-sweep. A run that moves between the statuses while the sweep runs is
 * listed under both and yielded only the first time.
 */
export async function* activeWorkflowRunPages({
  store,
  workflowName,
}: {
  store: WorkflowsStorage;
  workflowName: string;
}): AsyncGenerator<WorkflowRun[]> {
  const seen = new Set<string>();
  for (const status of ACTIVE_STATUSES) {
    const { runs } = await store.listWorkflowRuns({ workflowName, status, perPage: false });
    const unseen = runs.filter(run => !seen.has(run.runId) && !!seen.add(run.runId));
    for (let start = 0; start < unseen.length; start += PAGE_SIZE) yield unseen.slice(start, start + PAGE_SIZE);
  }
}
