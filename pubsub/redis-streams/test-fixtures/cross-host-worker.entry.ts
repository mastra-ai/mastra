import { createCrossHostRuntime } from './cross-host-resume';

// A worker-only host: it runs every workflow step but never owns a caller's live request context, so
// it rebuilds its registry entry from the run snapshot.
const { mastra, storage } = createCrossHostRuntime({
  host: 'W',
  schemaName: process.env.CROSS_HOST_SCHEMA!,
  connectionString: process.env.POSTGRES_CONNECTION_STRING!,
  redisUrl: process.env.REDIS_URL!,
  modelUrl: process.env.CROSS_HOST_MODEL_URL!,
  logFile: process.env.CROSS_HOST_LOG!,
  worker: true,
  observeToolResults: true,
});
await storage.init();
await mastra.startWorkers();
console.log('cross-host-worker-ready');
process.on('SIGTERM', () => {
  void mastra.shutdown().finally(() => process.exit(0));
});
