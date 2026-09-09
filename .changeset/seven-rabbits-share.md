---
'@mastra/memory': patch
'@mastra/core': patch
'@mastra/pg': patch
---

Added an optional `includeTotal` flag to message listing. Internal message-only memory reads now disable totals so PostgresStore skips counting all matching messages. For paginated reads, it fetches one extra row to determine `hasMore`. The flag defaults to `true`, preserving accurate totals for existing callers and Studio pagination.

```typescript
const memoryStore = await storage.getStore('memory');
if (!memoryStore) throw new Error('Memory storage is unavailable');

// Default: include an accurate total.
await memoryStore.listMessages({ threadId: 'thread-1', perPage: 20 });

// Skip the total when only messages and hasMore are needed.
const { messages, hasMore } = await memoryStore.listMessages({
  threadId: 'thread-1',
  perPage: 20,
  includeTotal: false,
});
```
