// @ts-nocheck
import { PostgresStore } from '@mastra/stores/pg';

const storage = new PostgresStore({
  id: 'my-storage',
  connectionString: process.env.DATABASE_URL,
});

// Should transform
const result = await storage.getMessagesById({
  messageIds: ['msg-1', 'msg-2'],
});

// Should NOT transform
const other = { getMessagesById: () => [] };
other.getMessagesById({ messageIds: [] });