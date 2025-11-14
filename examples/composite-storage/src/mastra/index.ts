import { Mastra } from '@mastra/core/mastra';
import { Observability } from '@mastra/observability';
import { MastraStorage } from '@mastra/core/storage';
import { MemoryStorage, ObservabilityStorage } from '@mastra/pg';
import { WorkflowsStorage } from '@mastra/libsql';
import { memoryAgent } from './agents';
import pgPromise from 'pg-promise';

const workflowsStorage = new WorkflowsStorage({
  config: {
    id: 'workflows-storage',
    url: 'file:./workflows.db',
  },
});

// Create a shared database client to avoid the duplicate database object warning
const pgp = pgPromise();

const sharedDbClient = pgp({
  connectionString: 'postgresql://postgres:postgres@localhost:5434/mastra',
});

const observabilityStorage = new ObservabilityStorage({
  client: sharedDbClient,
  schema: 'public',
});

const memoryStorage = new MemoryStorage({
  client: sharedDbClient,
  schema: 'public',
});

const storage = new MastraStorage({
  id: 'mastra-storage',
  name: 'Mastra Storage',
  stores: {
    memory: memoryStorage,
    workflows: workflowsStorage,
    observability: observabilityStorage,
  },
});

export const mastra = new Mastra({
  storage,
  agents: {
    memoryAgent,
  },
  observability: new Observability({ default: { enabled: true } }),
});
