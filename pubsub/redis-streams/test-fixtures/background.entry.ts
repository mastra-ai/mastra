/**
 * Spawned by background-cross-process.test.ts.
 *
 * Runs only the BackgroundTaskWorker. The worker subscribes to the
 * `background-tasks` PubSub topic with the `background-task-workers`
 * consumer group; `BackgroundTaskManager.enqueue()` from any process
 * publishes dispatch events that this worker will receive and act on.
 *
 * NOTE on the architectural gap surfaced by Phase 3:
 *   The dispatch event itself crosses processes via Redis Streams, but
 *   the per-task `executor` closure registered by `enqueue()` lives in
 *   the producer process's in-memory `taskContexts` map. When dispatch
 *   reaches a remote worker, the worker has no executor and marks the
 *   task `failed` with `"No executor registered for this task"`. The
 *   test asserts exactly that — proving the dispatch path is split-
 *   deployable today, while documenting the executor-resolution gap.
 *
 * Reads:
 *  - REDIS_URL
 *  - STORAGE_URL (libsql file:// shared with the producer)
 */
import { buildMastra } from './shared.js';

const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6381';
const storageUrl = process.env.STORAGE_URL ?? 'file::memory:';

const mastra = buildMastra({ storageUrl, redisUrl });
await mastra.startWorkers();

console.info('background-ready');

process.on('SIGTERM', async () => {
  try {
    await mastra.stopWorkers();
  } finally {
    process.exit(0);
  }
});
