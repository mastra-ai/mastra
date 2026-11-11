import type { WorkflowsStorage } from '../storage/domains/workflows/base';
import type { WorkflowRun } from '../storage/types';
import type { WorkflowRunStatus } from '../workflows/types';

/** Runs the recovery sweep handles per page, and so the size of each ownership batch. */
const PAGE_SIZE = 100;

const ACTIVE_STATUSES: WorkflowRunStatus[] = ['running', 'waiting'];

/** Splits `runs` into pages of at most {@link PAGE_SIZE}. */
function* chunks(runs: WorkflowRun[]): Generator<WorkflowRun[]> {
  for (let start = 0; start < runs.length; start += PAGE_SIZE) yield runs.slice(start, start + PAGE_SIZE);
}

/**
 * Pages through the `running` and `waiting` runs of one workflow, yielding
 * each run once, in pages of at most a hundred runs.
 *
 * A store that does not page by `createdAt` in the backend
 * (`listsWorkflowRunsByCreatedAt()`) is read once per status in full and split
 * here: each of its pages would cost a full read, or could skip runs when its
 * order does not follow `createdAt`.
 *
 * Other stores are paged by keyset on `createdAt`, newest first: each page asks
 * for runs created no later than the oldest run of the page before. Offset
 * paging would skip runs whenever a run on an earlier page leaves the status
 * filter (it finishes, often because the sweep just restarted it), and repeat
 * them when a run is created at the top. Runs created after the first page are
 * newer than the cursor and left for their own process.
 *
 * The cursor is inclusive and one millisecond past the oldest run, because
 * stores keep `createdAt` finer than a JavaScript `Date`; runs read twice are
 * dropped by id. When more runs share that millisecond than fit in a page, the
 * page brings nothing new, so the runs around it are read in one call and the
 * cursor moves past them. If the cursor stops moving anyway (the store ignored
 * `toDate`, or a `createdAt` is unreadable), the rest is read in one call.
 */
export async function* activeWorkflowRunPages({
  store,
  workflowName,
}: {
  store: WorkflowsStorage;
  workflowName: string;
}): AsyncGenerator<WorkflowRun[]> {
  // Shared by both statuses: a run that moves between them mid-sweep is listed under each.
  const seen = new Set<string>();
  const unseen = (runs: WorkflowRun[]) => runs.filter(run => !seen.has(run.runId) && !!seen.add(run.runId));
  const rest = async (status: WorkflowRunStatus, toDate?: Date) =>
    unseen((await store.listWorkflowRuns({ workflowName, status, toDate, perPage: false })).runs);

  const pagesInStore = store.listsWorkflowRunsByCreatedAt();
  for (const status of ACTIVE_STATUSES) {
    if (!pagesInStore) {
      yield* chunks(await rest(status));
      continue;
    }
    let toDate: Date | undefined;
    let crowdedAt = Infinity;
    for (;;) {
      const { runs } = await store.listWorkflowRuns({ workflowName, status, toDate, perPage: PAGE_SIZE, page: 0 });
      const page = unseen(runs);
      if (page.length > 0) yield page;
      if (runs.length < PAGE_SIZE) break;
      const oldest = new Date(runs[runs.length - 1]!.createdAt).getTime();
      if (Number.isNaN(oldest) || (page.length === 0 && !(oldest < crowdedAt))) {
        yield* chunks(await rest(status, toDate));
        break;
      }
      if (page.length > 0) {
        toDate = new Date(oldest + 1);
        continue;
      }
      crowdedAt = oldest;
      const { runs: crowded } = await store.listWorkflowRuns({
        workflowName,
        status,
        fromDate: new Date(oldest - 1),
        toDate: new Date(oldest + 1),
        perPage: false,
      });
      yield* chunks(unseen(crowded));
      toDate = new Date(oldest - 1);
    }
  }
}
