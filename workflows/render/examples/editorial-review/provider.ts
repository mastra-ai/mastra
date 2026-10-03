import { createPostgresPersistence, init } from '@renderinc/mastra';
import { PostgresStore } from '@mastra/pg';

const connectionString = process.env.DATABASE_URL;
const workflowSlug = process.env.RENDER_WORKFLOW_SLUG;
const buildId = process.env.APP_BUILD_ID;
if (!connectionString || !workflowSlug || !buildId)
  throw new Error('DATABASE_URL, RENDER_WORKFLOW_SLUG and APP_BUILD_ID are required');

export const persistence = createPostgresPersistence({ connectionString, max: 5 });
export const storage = new PostgresStore({ id: 'editorial-review', connectionString });
export const { createStep, createWorkflow, provider } = init({
  workflowSlug,
  buildId,
  persistence,
  rootTask: { plan: 'flex', timeoutSeconds: 600 },
  stepDefaults: { plan: 'flex', timeoutSeconds: 120, retry: { maxRetries: 1, waitDurationMs: 1000 } },
  maxConcurrentSteps: 4,
});
