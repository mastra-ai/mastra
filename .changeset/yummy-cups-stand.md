---
'@mastra/core': minor
'@mastra/pg': minor
'@mastra/libsql': minor
'@mastra/mongodb': minor
'@mastra/upstash': minor
'@mastra/mssql': minor
'@mastra/convex': minor
'@mastra/lance': minor
'@mastra/cloudflare': minor
'@mastra/cloudflare-d1': minor
'@mastra/clickhouse': minor
'@mastra/server': patch
---

Added `lastMessageAt` field to threads. This nullable timestamp only updates when new messages are saved to a thread, unlike `updatedAt` which also changes on title/metadata edits. New threads and existing threads without messages will have `lastMessageAt` as `null`.

**Sort threads by last message time:**

```ts
const result = await memory.listThreads({
  filter: { resourceId: "user-123" },
  orderBy: { field: "lastMessageAt", direction: "DESC" },
});

// Each thread now includes lastMessageAt
for (const thread of result.threads) {
  console.log(thread.lastMessageAt); // Date | null
}
```
