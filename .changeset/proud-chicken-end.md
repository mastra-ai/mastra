---
'@mastra/playground-ui': major
'@mastra/client-js': major
'@mastra/cloudflare-d1': major
'@mastra/deployer': major
'@mastra/clickhouse': major
'@mastra/cloudflare': major
'@mastra/memory': major
'@mastra/server': major
'@mastra/dynamodb': major
'@mastra/mongodb': major
'@mastra/upstash': major
'@mastra/core': major
'@mastra/libsql': major
'@mastra/lance': major
'@mastra/mssql': major
'@mastra/pg': major
---

**BREAKING CHANGE**: Pagination APIs now use `page`/`perPage` instead of `offset`/`limit`

All storage and memory pagination APIs have been updated to use `page` (0-indexed) and `perPage` instead of `offset` and `limit`, aligning with standard REST API patterns.

**Affected APIs:**
- `Memory.listThreadsByResourceId()`
- `Memory.listMessages()`
- `Storage.listWorkflowRuns()`

**Migration:**
```typescript
// Before
await memory.listThreadsByResourceId({
  resourceId: "user-123",
  offset: 20,
  limit: 10,
});

// After
await memory.listThreadsByResourceId({
  resourceId: "user-123",
  page: 2,      // page = Math.floor(offset / limit)
  perPage: 10,
});

// Before
await memory.listMessages({
  threadId: "thread-456",
  offset: 20,
  limit: 10,
});

// After
await memory.listMessages({
  threadId: "thread-456",
  page: 2,
  perPage: 10,
});

// Before
await storage.listWorkflowRuns({
  workflowName: "my-workflow",
  offset: 20,
  limit: 10,
});

// After
await storage.listWorkflowRuns({
  workflowName: "my-workflow",
  page: 2,
  perPage: 10,
});
```

**Additional improvements:**
- Added validation for negative `page` values in all storage implementations
- Improved `perPage` validation to handle edge cases (negative values, `0`, `false`)
- Added reusable query parser utilities for consistent validation in handlers
