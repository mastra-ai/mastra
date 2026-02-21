---
'@mastra/core': minor
---

Add `lastMessageAt` field to threads. This nullable timestamp tracks when the most recent message was saved to a thread, unlike `updatedAt` which also changes on title/metadata edits. New threads and existing threads without messages will have `lastMessageAt` as `null`.

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
