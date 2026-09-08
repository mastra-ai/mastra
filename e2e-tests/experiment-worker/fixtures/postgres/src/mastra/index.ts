import { Mastra } from '@mastra/core/mastra';
import { createStep, createWorkflow } from '@mastra/core/workflows';
import { PostgresStore } from '@mastra/pg';
import { z } from 'zod';

const connectionString =
  process.env.EXPERIMENT_WORKER_POSTGRES_URL ?? 'postgresql://postgres:postgres@127.0.0.1:5432/postgres';

const storage = new PostgresStore({
  id: 'experiment-worker-postgres',
  connectionString,
});

const persistStep = createStep({
  id: 'postgres-persist-step',
  inputSchema: z.object({ threadId: z.string() }),
  outputSchema: z.object({ threadId: z.string() }),
  execute: async ({ inputData, mastra }) => {
    const applicationStorage = mastra?.getStorage();
    if (!applicationStorage) throw new Error('Postgres storage is not configured');
    const memory = await applicationStorage.getStore('memory');
    if (!memory) throw new Error('Postgres memory domain is unavailable');

    const now = new Date();
    await memory.saveThread({
      thread: {
        id: inputData.threadId,
        resourceId: 'experiment-worker-postgres-fixture',
        title: 'Postgres experiment worker persistence proof',
        createdAt: now,
        updatedAt: now,
        metadata: {},
      },
    });

    return { threadId: inputData.threadId };
  },
});

const postgresWorkflow = createWorkflow({
  id: 'postgres-workflow',
  inputSchema: z.object({ threadId: z.string() }),
  outputSchema: z.object({ threadId: z.string() }),
})
  .then(persistStep)
  .commit();

export const mastra = new Mastra({
  storage,
  workflows: { postgresWorkflow },
});
