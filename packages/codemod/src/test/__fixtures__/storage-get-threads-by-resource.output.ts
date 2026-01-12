// @ts-nocheck
import { PostgresStore } from '@mastra/stores/pg';

const storage = new PostgresStore({
  id: 'my-storage',
  connectionString: process.env.DATABASE_URL,
});

// Should transform
const threads = await storage.listThreads({
  filter: { resourceId: 'res-123' },
});

// Should NOT transform - different object
const other = {
  getThreadsByResourceId: () => []
};
other.getThreadsByResourceId({ resourceId: 'test' });