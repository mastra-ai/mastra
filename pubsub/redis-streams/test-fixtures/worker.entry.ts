/**
 * Spawned by cross-process.test.ts.
 *
 * Runs a Mastra instance that calls `startWorkers('orchestration')` to start
 * just the OrchestrationWorker. Because MASTRA_STEP_EXECUTION_URL is set,
 * the worker injects HttpRemoteStrategy into the WEP — when a step needs
 * to execute, the worker calls back to the server via HTTP rather than
 * running it locally.
 *
 * Reads:
 *  - REDIS_URL
 *  - STORAGE_URL (libsql file:// URL shared with the server)
 *  - MASTRA_STEP_EXECUTION_URL (server URL to call back to)
 *
 * Logs `worker-ready` to stdout once the worker has started.
 */
import { buildMastra } from './shared.js';

const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6381';
const storageUrl = process.env.STORAGE_URL ?? 'file::memory:';

const mastra = buildMastra({ storageUrl, redisUrl });
await mastra.startWorkers();

console.info('worker-ready');

process.on('SIGTERM', async () => {
  try {
    await mastra.stopWorkers();
  } finally {
    process.exit(0);
  }
});
