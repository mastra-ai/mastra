/**
 * Generic worker entry used by every cross-process test.
 *
 * This file mirrors what `WorkerBundler.getEntry()` emits: it imports
 * `mastra` from the user-owned project root and calls
 * `mastra.startWorkers()`. Worker role selection is driven by the
 * `MASTRA_WORKERS` env var inside `Mastra` itself — the same way it
 * works in production, where one bundle is shipped and the deployment
 * picks the role.
 *
 *   MASTRA_WORKERS=orchestration   → just the orchestrator
 *   MASTRA_WORKERS=scheduler       → just the scheduler
 *   MASTRA_WORKERS=backgroundTasks → just the background-task worker
 *   (unset)                        → all workers
 *
 * The readiness marker mirrors the role for ergonomic test waits:
 *
 *   MASTRA_WORKERS=scheduler        → `scheduler-ready`
 *   MASTRA_WORKERS=backgroundTasks  → `background-ready`
 *   anything else (incl. unset)     → `worker-ready`
 */
import { mastra } from './cli-project/src/mastra/index.js';

await mastra.startWorkers();

const filter = process.env.MASTRA_WORKERS;
const marker =
  filter === 'scheduler' ? 'scheduler-ready' : filter === 'backgroundTasks' ? 'background-ready' : 'worker-ready';
console.info(marker);

const shutdown = async () => {
  try {
    await mastra.stopWorkers();
  } finally {
    process.exit(0);
  }
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
