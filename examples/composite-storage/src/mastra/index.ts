import { Mastra } from '@mastra/core/mastra';
import { Observability } from '@mastra/observability';
import { MastraStorage } from '@mastra/core/storage';
import { ObservabilityStorage } from '@mastra/pg';
import { LibSQLStore } from '@mastra/libsql';
import { memoryAgent } from './agents';
import pgPromise from 'pg-promise';

// Create a default LibSQL store for all domains
const defaultStore = new LibSQLStore({
  id: 'default-storage',
  url: 'file:./default.db',
});

// Create a shared PostgreSQL database client for observability
const pgp = pgPromise();
const sharedDbClient = pgp({
  connectionString: 'postgresql://postgres:postgres@localhost:5434/mastra',
});

// Override observability to use PostgreSQL
const observabilityStorage = new ObservabilityStorage({
  client: sharedDbClient,
  schema: 'public',
});

// Create composite storage with default store and observability override
// All other domains (workflows, memory, evals) will use the default LibSQL store
const storage = new MastraStorage({
  id: 'mastra-storage',
  name: 'Mastra Storage',
  default: defaultStore, // Default store for unspecified domains
  stores: {
    observability: observabilityStorage, // Override observability to use PostgreSQL
  },
});

export const mastra = new Mastra({
  storage,
  agents: {
    memoryAgent,
  },
  observability: new Observability({ default: { enabled: true } }),
});
