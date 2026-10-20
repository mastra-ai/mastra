/** Grouped trace aggregates are the page's heaviest requests; the server budget allows three at once. */
export const MAX_TRACE_AGGREGATES_IN_FLIGHT = 3;

export type RequestLimiter = {
  /** Runs `task` once a slot is free. A task whose `signal` aborted while it waited is never started. */
  run<T>(task: () => Promise<T>, signal?: AbortSignal): Promise<T>;
};

export function createRequestLimiter(max: number): RequestLimiter {
  let active = 0;
  const waiting: Array<() => void> = [];

  const release = () => {
    active--;
    waiting.shift()?.();
  };

  return {
    run(task, signal) {
      return new Promise((resolve, reject) => {
        const start = () => {
          if (signal?.aborted) {
            reject(signal.reason);
            waiting.shift()?.();
            return;
          }
          active++;
          task().then(resolve, reject).finally(release);
        };
        if (active < max) start();
        else waiting.push(start);
      });
    },
  };
}
