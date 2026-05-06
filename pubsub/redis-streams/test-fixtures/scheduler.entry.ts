/**
 * Spawned by scheduler-cross-process.test.ts.
 *
 * Runs only the SchedulerWorker. The scheduler polls storage for due
 * schedules, advances `nextFireAt` via CAS, and publishes
 * `workflow.start` events to the `workflows` PubSub topic. It does NOT
 * execute workflows itself — an orchestration worker (separate process)
 * consumes those events.
 *
 * Reads:
 *  - REDIS_URL
 *  - STORAGE_URL (libsql file:// shared with the rest of the cluster)
 */
import { buildMastra } from './shared.js';

const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6381';
const storageUrl = process.env.STORAGE_URL ?? 'file::memory:';

const mastra = buildMastra({ storageUrl, redisUrl });
// Drive the env-based filter so we exercise that codepath in real cluster
// fixtures rather than just unit tests.
await mastra.startWorkers();

console.info('scheduler-ready');

process.on('SIGTERM', async () => {
  try {
    await mastra.stopWorkers();
  } finally {
    process.exit(0);
  }
});
