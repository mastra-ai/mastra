/**
 * Per-process worker setting for cross-process tests.
 *
 * Mastra never starts workers on its own: a process consumes events only after
 * it calls `mastra.startWorkers()`. Topologies like "API process with workers
 * off hands the run to a separate worker process" therefore need two processes
 * running with *different* worker settings at the same time.
 *
 * Every process in an `xproc` test carries its own setting: `env.workers` for
 * the test process, `peer.workers` (or `spawnPeer(..., { workers })`) for each
 * peer. `bootWorkers` is the single place that turns that setting into the
 * `startWorkers()` call, so a `workers: false` process can never consume
 * events by accident — exactly the producer side of a producer/worker split.
 *
 * Fixtures construct their own `Mastra` with `workers: peer.workers ? undefined
 * : false` and call `bootWorkers`; the helper does not build `Mastra` for them.
 */

/** Anything that can boot its event workers, i.e. a `Mastra` instance. */
export interface WorkerHost {
  startWorkers(): Promise<void>;
}

/** Start this process's workers when they are enabled; a no-op otherwise. */
export async function bootWorkers(host: WorkerHost, workers: boolean): Promise<void> {
  if (workers) await host.startWorkers();
}
