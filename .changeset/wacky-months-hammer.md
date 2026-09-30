---
'@mastra/core': minor
'@mastra/memory': minor
---

Added thread archiving. Archived threads are kept with their messages but can be hidden from thread lists, and restored later. Archiving does not change `updatedAt`, so thread order is preserved.

```ts
await memory.archiveThread({ threadId: 'thread-123' });

const active = await memory.listThreads({
  filter: { resourceId: 'user-123', archived: false },
});

await memory.unarchiveThread({ threadId: 'thread-123' });
```

Omitting `archived` returns all threads, as before.
