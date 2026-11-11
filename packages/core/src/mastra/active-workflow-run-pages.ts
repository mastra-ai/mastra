import type { WorkflowsStorage } from '../storage/domains/workflows/base';
import type { WorkflowRun } from '../storage/types';
import type { WorkflowRunStatus } from '../workflows/types';

/** Runs the recovery sweep reads per storage call, and so the size of each ownership batch. */
const PAGE_SIZE = 100;

const ACTIVE_STATUSES: WorkflowRunStatus[] = ['running', 'waiting'];

/** Whether `times` never increases, the order keyset paging relies on. */
function isNewestFirst(times: number[]): boolean {
  return times.every((time, i) => !Number.isNaN(time) && (i === 0 || time <= times[i - 1]!));
}

/** Splits `runs` into pages of at most `size`. */
function* chunks(runs: WorkflowRun[], size: number): Generator<WorkflowRun[]> {
  for (let start = 0; start < runs.length; start += size) yield runs.slice(start, start + size);
}

/**
 * Pages through the `running` and `waiting` runs of one workflow, yielding
 * each run once, in pages of at most a hundred runs.
 *
 * Paging is keyset on `createdAt`, newest first: each page asks for runs
 * created no later than the oldest run of the page before. Offset paging would
 * skip runs whenever a run on an earlier page leaves the status filter (it
 * finishes, often because the sweep just restarted it), and repeat them when a
 * run is created at the top. Runs created after the first page are newer than
 * the cursor and left for their own process.
 *
 * The cursor is inclusive and one millisecond past the oldest run, because
 * stores keep `createdAt` finer than a JavaScript `Date`; runs read twice are
 * dropped by id. When more runs share that millisecond than fit in a page, the
 * page brings nothing new, so the runs around it are read in one call and the
 * cursor moves past them. A store that does not list newest first (its page is
 * out of order) gets the rest of the runs in one call, as before paging.
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

  for (const status of ACTIVE_STATUSES) {
    let toDate: Date | undefined;
    for (;;) {
      const { runs } = await store.listWorkflowRuns({ workflowName, status, toDate, perPage: PAGE_SIZE, page: 0 });
      const times = runs.map(run => new Date(run.createdAt).getTime());
      if (!isNewestFirst(times)) {
        const { runs: rest } = await store.listWorkflowRuns({ workflowName, status, toDate, perPage: false });
        yield* chunks(unseen(rest), PAGE_SIZE);
        break;
      }
      const page = unseen(runs);
      if (page.length > 0) yield page;
      if (runs.length < PAGE_SIZE) break;
      const oldest = times[times.length - 1]!;
      if (page.length > 0) {
        toDate = new Date(oldest + 1);
        continue;
      }
      const { runs: crowded } = await store.listWorkflowRuns({
        workflowName,
        status,
        fromDate: new Date(oldest - 1),
        toDate: new Date(oldest + 1),
        perPage: false,
      });
      yield* chunks(unseen(crowded), PAGE_SIZE);
      toDate = new Date(oldest - 1);
    }
  }
}
