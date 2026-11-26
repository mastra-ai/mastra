import { RequestContext } from '@mastra/core/request-context';
import { createCrossHostRuntime } from './cross-host-resume';

// Host B: no workers. Approves the parked run as a different user, so this host claims the resume
// while host A is the only process consuming workflow events.
const { mastra, agent, storage } = createCrossHostRuntime({
  host: 'B',
  schemaName: process.env.CROSS_HOST_SCHEMA!,
  connectionString: process.env.POSTGRES_CONNECTION_STRING!,
  redisUrl: process.env.REDIS_URL!,
  modelUrl: process.env.CROSS_HOST_MODEL_URL!,
  logFile: process.env.CROSS_HOST_LOG!,
  worker: false,
});
await storage.init();
const requestContext = new RequestContext();
requestContext.set('resume-marker', 'B');
requestContext.set('mastra__user', { id: 'bob' });
const resumed = await agent.approveToolCall({
  runId: process.env.CROSS_HOST_RUN_ID!,
  toolCallId: 'approval-one',
  requestContext,
});
console.log('host-b-approved');
const text = await Promise.race([
  resumed.text,
  new Promise(resolve => setTimeout(() => resolve('reader-timeout'), 30_000)),
]);
console.log(`host-b-text:${text}`);
await mastra.shutdown();
process.exit(0);
