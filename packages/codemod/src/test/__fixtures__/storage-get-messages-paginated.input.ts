// @ts-nocheck
import { PostgresStore } from '@mastra/stores/pg';

const storage = new PostgresStore({ id: 'storage', connectionString: '' });

const result = await storage.getMessagesPaginated({
  threadId: 'thread-123',
  offset: 0,
  limit: 20,
});

const other = { getMessagesPaginated: () => [] };
other.getMessagesPaginated({});
