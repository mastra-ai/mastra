import { Mastra } from '@mastra/core/mastra';
import { createStep, createWorkflow } from '@mastra/core/workflows/evented';
import { LibSQLStore } from '@mastra/libsql';
import { createClient } from 'redis';
import { z } from 'zod';
import { RedisStreamsPubSub } from '../src/index.js';

const { REDIS_URL, STORAGE_URL, RECOVERY_PREFIX, WORKER_ROLE } = process.env;
if (!REDIS_URL || !STORAGE_URL || !RECOVERY_PREFIX || !WORKER_ROLE) throw new Error('Missing fixture configuration');

const client = createClient({ url: REDIS_URL });
await client.connect();
const schema = z.object({});
const prepare = createStep({ id: 'prepare', inputSchema: schema, outputSchema: schema, execute: async () => ({}) });
const charge = createStep({
  id: 'charge-card',
  inputSchema: schema,
  outputSchema: schema,
  execute: async () => {
    await client.rPush(`${RECOVERY_PREFIX}:charges`, WORKER_ROLE);
    if (WORKER_ROLE === 'A') {
      while (!(await client.exists(`${RECOVERY_PREFIX}:release`))) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    return {};
  },
});
const workflow = createWorkflow({
  id: 'charge-card-workflow',
  inputSchema: schema,
  outputSchema: schema,
  steps: [prepare, charge],
})
  .then(prepare)
  .then(charge)
  .commit();
const pubsub = new RedisStreamsPubSub({ url: REDIS_URL, keyPrefix: RECOVERY_PREFIX });
const storage = new LibSQLStore({ id: 'recovery-test', url: STORAGE_URL });
const mastra = new Mastra({
  storage,
  pubsub,
  logger: false,
  workflows: { [workflow.id]: workflow },
});
await mastra.startWorkers();
console.log('worker-ready');
if (WORKER_ROLE === 'A') {
  const run = await mastra.getWorkflow('charge-card-workflow').createRun();
  await client.set(`${RECOVERY_PREFIX}:run`, run.runId);
  void run.start({ inputData: {} });
} else {
  await mastra.restartAllActiveWorkflowRuns();
  console.log('sweep-done');
}
process.on('SIGTERM', () => {
  void Promise.all([mastra.stopWorkers(), pubsub.close(), client.quit(), storage.close()]).finally(() =>
    process.exit(0),
  );
});
setInterval(() => {}, 60_000);
