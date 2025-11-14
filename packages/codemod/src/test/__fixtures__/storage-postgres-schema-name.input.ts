// @ts-nocheck
import { PostgresStore } from '@mastra/stores/pg';

const pgStore = new PostgresStore({
  id: 'my-storage',
  connectionString: process.env.POSTGRES_CONNECTION_STRING,
  schema: customSchema,
});

// Should NOT transform - not PostgresStore
const other = {
  schema: 'test'
};
