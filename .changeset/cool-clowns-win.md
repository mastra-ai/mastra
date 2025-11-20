---
'@mastra/longmemeval': major
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

# Major Changes

## Storage Layer

### BREAKING: Removed `storage.getMessages()`

The `getMessages()` method has been removed from all storage implementations. Use `listMessages()` instead, which provides pagination support.

**Migration:**

```typescript
// Before
const messages = await storage.getMessages({ threadId: 'thread-1' });

// After
const result = await storage.listMessages({
  threadId: 'thread-1',
  page: 0,
  perPage: 50
});
const messages = result.messages; // Access messages array
console.log(result.total);        // Total count
console.log(result.hasMore);      // Whether more pages exist
```

### Message ordering default

`listMessages()` defaults to ASC (oldest first) ordering by `createdAt`, matching the previous `getMessages()` behavior.

**To use DESC ordering (newest first):**
```typescript
const result = await storage.listMessages({
  threadId: 'thread-1',
  orderBy: { field: 'createdAt', direction: 'DESC' }
});
```

## Client SDK

### BREAKING: Renamed `client.getThreadMessages()` → `client.listThreadMessages()`

**Migration:**

```typescript
// Before
const response = await client.getThreadMessages(threadId, { agentId });

// After
const response = await client.listThreadMessages(threadId, { agentId });
```

The response format remains the same.

## Type Changes

### BREAKING: Removed `StorageGetMessagesArg` type

Use `StorageListMessagesInput` instead:

```typescript
// Before
import type { StorageGetMessagesArg } from '@mastra/core';

// After
import type { StorageListMessagesInput } from '@mastra/core';
```
