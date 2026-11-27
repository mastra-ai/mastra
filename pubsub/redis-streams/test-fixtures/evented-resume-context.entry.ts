import { createResumeContextRuntime } from './evented-resume-context';

const { mastra } = createResumeContextRuntime({
  schemaName: process.env.RESUME_CONTEXT_SCHEMA!,
  connectionString: process.env.POSTGRES_CONNECTION_STRING!,
  redisUrl: process.env.REDIS_URL!,
  modelUrl: process.env.RESUME_CONTEXT_MODEL_URL!,
  worker: true,
});
await mastra.startWorkers();
process.on('SIGTERM', async () => {
  await mastra.shutdown();
  process.exit(0);
});
console.log('resume-context-worker-ready');
