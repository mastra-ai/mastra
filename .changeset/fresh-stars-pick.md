---
'@mastra/cloudflare-d1': patch
'@mastra/clickhouse': patch
'@mastra/cloudflare': patch
'@mastra/dynamodb': patch
'@mastra/mongodb': patch
'@mastra/upstash': patch
'@mastra/core': patch
'@mastra/convex': patch
'@mastra/libsql': patch
'@mastra/lance': patch
'@mastra/mssql': patch
'@mastra/pg': patch
---

Added `startExclusive` and `endExclusive` options to `dateRange` filter for message queries.

**What changed:** The `filter.dateRange` parameter in `listMessages()` and `Memory.recall()` now supports `startExclusive` and `endExclusive` boolean options. When set to `true`, messages with timestamps exactly matching the boundary are excluded from results.

**Why this matters:** Enables cursor-based pagination for chat applications. When new messages arrive during a session, offset-based pagination can skip or duplicate messages. Using `endExclusive: true` with the oldest message's timestamp as a cursor ensures consistent pagination without gaps or duplicates.

**Example:**

```typescript
// Get first page
const page1 = await memory.recall({
  threadId: "thread-123",
  perPage: 10,
  orderBy: { field: "createdAt", direction: "DESC" },
});

// Get next page using cursor-based pagination
const oldestMessage = page1.messages[page1.messages.length - 1];
const page2 = await memory.recall({
  threadId: "thread-123",
  perPage: 10,
  orderBy: { field: "createdAt", direction: "DESC" },
  filter: {
    dateRange: {
      end: oldestMessage.createdAt,
      endExclusive: true, // Excludes the cursor message
    },
  },
});
```
