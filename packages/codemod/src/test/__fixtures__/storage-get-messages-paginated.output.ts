// @ts-nocheck
import { PostgresStore } from '@mastra/stores/pg';

const storage = new PostgresStore({ id: 'storage', connectionString: '' });

const result = await storage.listMessages({
  threadId: 'thread-123',
  page: 0,
  perPage: 20,
});

const other = { getMessagesPaginated: () => [] };
other.getMessagesPaginated({});
