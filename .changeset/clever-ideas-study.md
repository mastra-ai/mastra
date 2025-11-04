---
'@mastra/core': major
'@mastra/server': major
'@mastra/deployer': major
'@mastra/client-js': major
'@mastra/memory': major
'@mastra/pg': major
'@mastra/mongodb': major
'@mastra/clickhouse': major
'@mastra/cloudflare': major
'@mastra/cloudflare-d1': major
'@mastra/dynamodb': major
'@mastra/lance': major
'@mastra/libsql': major
'@mastra/mssql': major
'@mastra/upstash': major
'@mastra/longmemeval': major
---

**BREAKING:** Remove `getMessagesPaginated()` and add `perPage: false` support

Removes deprecated `getMessagesPaginated()` method. The `listMessages()` API and score handlers now support `perPage: false` to fetch all records without pagination limits.

**Storage changes:**
- `StoragePagination.perPage` type changed from `number` to `number | false`
- All storage implementations support `perPage: false`:
  - Memory: `listMessages()`
  - Scores: `listScoresBySpan()`, `listScoresByRunId()`, `listScoresByExecutionId()`
- HTTP query parser accepts `"false"` string (e.g., `?perPage=false`)

**Memory changes:**
- `memory.query()` parameter type changed from `StorageGetMessagesArg` to `StorageListMessagesInput`
- Uses flat parameters (`page`, `perPage`, `include`, `filter`, `vectorSearchString`) instead of `selectBy` object

**Stricter validation:**
- `listMessages()` requires non-empty, non-whitespace `threadId` (throws error instead of returning empty results)

**Migration:**
```typescript
// Storage/Memory: Replace getMessagesPaginated with listMessages
- storage.getMessagesPaginated({ threadId, selectBy: { pagination: { page: 0, perPage: 20 } } })
+ storage.listMessages({ threadId, page: 0, perPage: 20 })
+ storage.listMessages({ threadId, page: 0, perPage: false })  // Fetch all

// Memory: Replace selectBy with flat parameters
- memory.query({ threadId, selectBy: { last: 20, include: [...] } })
+ memory.query({ threadId, perPage: 20, include: [...] })

// Client SDK
- thread.getMessagesPaginated({ selectBy: { pagination: { page: 0 } } })
+ thread.listMessages({ page: 0, perPage: 20 })
```
