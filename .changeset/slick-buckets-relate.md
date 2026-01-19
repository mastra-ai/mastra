---
'@mastra/core': minor
'@mastra/memory': minor
'@mastra/server': minor
'@mastra/client-js': minor
'@mastra/longmemeval': patch
'@mastra/cloudflare-d1': patch
'@mastra/clickhouse': patch
'@mastra/cloudflare': patch
'@mastra/codemod': patch
'@mastra/dynamodb': patch
'@mastra/mongodb': patch
'@mastra/upstash': patch
'@mastra/convex': patch
'@mastra/libsql': patch
'@mastra/lance': patch
'@mastra/mssql': patch
'@mastra/pg': patch
---

Added new `listThreads` method for flexible thread filtering across all storage adapters.

**New Features**

- Filter threads by `resourceId`, `metadata`, or both (with AND logic for metadata key-value pairs)
- All filter parameters are optional, allowing you to list all threads or filter as needed
- Full pagination and sorting support

**Example Usage**

```typescript
// List all threads
const allThreads = await memory.listThreads({});

// Filter by resourceId only
const userThreads = await memory.listThreads({
  filter: { resourceId: 'user-123' },
});

// Filter by metadata only
const supportThreads = await memory.listThreads({
  filter: { metadata: { category: 'support' } },
});

// Filter by both with pagination
const filteredThreads = await memory.listThreads({
  filter: {
    resourceId: 'user-123',
    metadata: { priority: 'high', status: 'open' },
  },
  orderBy: { field: 'updatedAt', direction: 'DESC' },
  page: 0,
  perPage: 20,
});
```

**Security Improvements**

- Added validation to prevent SQL injection via malicious metadata keys
- Added pagination parameter validation to prevent integer overflow attacks
