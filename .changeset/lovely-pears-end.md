---
'@mastra/cloudflare-d1': patch
'@mastra/clickhouse': patch
'@mastra/cloudflare': patch
'@mastra/dynamodb': patch
'@mastra/mongodb': patch
'@mastra/spanner': patch
'@mastra/upstash': patch
'@mastra/convex': patch
'@mastra/libsql': patch
'@mastra/lance': patch
'@mastra/mssql': patch
'@mastra/mysql': patch
'@mastra/redis': patch
'@mastra/dsql': patch
'@mastra/pg': patch
---

Fixed `listMessages` returning messages from other resources when `include` was used.

Passing a message ID owned by a different resource returned that message, plus its surrounding messages when `withPreviousMessages` or `withNextMessages` were set, even though `resourceId` was supplied. Semantic recall reached this path too, because it passes `resourceId` and `include` together. Included messages and their context are now scoped to `resourceId` the same way the main query already was.

```ts
// Before: could return messages owned by another resource
const result = await storage.listMessages({
  threadId: 'thread-b',
  resourceId: 'resource-b',
  include: [{ id: 'message-owned-by-resource-a', withPreviousMessages: 2 }],
});

// After: IDs outside resource-b are skipped
```

Including a message from another thread in the same resource still works, and nothing changes when you omit `resourceId`. Messages stored without a `resourceId` are now skipped by `include` when you pass one, which matches how the main query already treated them.
