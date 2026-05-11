---
"@mastra/core": patch
"@mastra/pg": patch
"@mastra/libsql": patch
"@mastra/clickhouse": patch
"@mastra/cloudflare": patch
"@mastra/cloudflare-d1": patch
"@mastra/convex": patch
"@mastra/dynamodb": patch
"@mastra/lance": patch
"@mastra/mongodb": patch
"@mastra/mssql": patch
"@mastra/redis": patch
"@mastra/upstash": patch
---

Respect optional `resourceId` in `getThreadById` so scoped thread lookups return `null` when the thread belongs to a different resource.

Example:

```typescript
const thread = await memory.getThreadById({
  threadId: 'my-thread-id',
  resourceId: 'my-user-id',
});
// Returns null if the thread does not belong to 'my-user-id'.
```
