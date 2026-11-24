/** Grouped trace and span aggregates are the page's heaviest requests; the server budget allows three at once. */
export const MAX_AGGREGATES_IN_FLIGHT = 3;

/** Lower runs first. Cards above the fold use `first`; comparisons with an earlier window use `last`. */
export const AGGREGATE_PRIORITY = { first: 0, normal: 1, last: 2 } as const;

export type AggregatePriority = (typeof AGGREGATE_PRIORITY)[keyof typeof AGGREGATE_PRIORITY];

export type RequestLimiterOptions = {
  /** Lower runs first; equal priorities run in the order they were queued. Defaults to `normal`. */
  priority?: AggregatePriority;
  /**
   * Asked when a queued task reaches the front. A task nobody wants any more (its card unmounted) is
   * skipped instead of sent. Tasks that start at once are never asked.
   */
  isWanted?: () => boolean;
};

/** Rejects a queued task that `isWanted` turned down. */
export class SkippedRequestError extends Error {
  constructor() {
    super('Skipped: nothing is waiting for this request any more');
    this.name = 'SkippedRequestError';
  }
}

export type RequestLimiter = {
  /** Runs `task` once a slot is free. A started task always runs to the end; nothing aborts it. */
  run<T>(task: () => Promise<T>, options?: RequestLimiterOptions): Promise<T>;
};

type Waiting = { priority: number; start: () => void };

export function createRequestLimiter(max: number): RequestLimiter {
  let active = 0;
  const waiting: Waiting[] = [];

  const next = () => {
    if (active < max) waiting.shift()?.start();
  };

  return {
    run(task, { priority = AGGREGATE_PRIORITY.normal, isWanted } = {}) {
      return new Promise((resolve, reject) => {
        const start = (queued: boolean) => {
          if (queued && isWanted && !isWanted()) {
            reject(new SkippedRequestError());
            next();
            return;
          }
          active++;
          task()
            .then(resolve, reject)
            .finally(() => {
              active--;
              next();
            });
        };
        if (active < max && waiting.length === 0) {
          start(false);
          return;
        }
        const entry: Waiting = { priority, start: () => start(true) };
        const at = waiting.findIndex(w => w.priority > priority);
        if (at === -1) waiting.push(entry);
        else waiting.splice(at, 0, entry);
      });
    },
  };
}
