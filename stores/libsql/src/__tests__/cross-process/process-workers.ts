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
 *
 * `bootWorkers` also records that this process booted, so the peer runtime can
 * fail a peer that did not do what its setting said. `Mastra` cannot tell us:
 * with a push-only pubsub `mastra.workers` is empty whether workers are enabled
 * or not, and `#workersDisabled` has no public accessor, so a forgotten call
 * would otherwise surface only as a test that waits for an event this process
 * was never going to consume.
 */

/** Anything that can boot its event workers, i.e. a `Mastra` instance. */
export interface WorkerHost {
  startWorkers(): Promise<void>;
}

/** Whether this process ran `bootWorkers(host, true)`. Per process, not per host. */
let workersStarted = false;

/** Start this process's workers when they are enabled; a no-op otherwise. */
export async function bootWorkers(host: WorkerHost, workers: boolean): Promise<void> {
  if (!workers) return;
  await host.startWorkers();
  workersStarted = true;
}

/**
 * Why this process's worker setting and what it actually did disagree, or
 * `undefined` when they agree. The peer runtime fails a peer on a mismatch.
 */
export function workerBootMismatch(workers: boolean): string | undefined {
  if (workers === workersStarted) return undefined;
  return workers
    ? 'it declares workers: true but never called bootWorkers(host, true), so it does not consume workflow events'
    : 'it declares workers: false but called bootWorkers(host, true), so it consumes workflow events anyway';
}
