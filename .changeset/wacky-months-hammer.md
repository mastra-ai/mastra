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

Omitting `archived` returns all threads, as before, so pass `archived: false` wherever you list active conversations.

Archiving is idempotent: archiving an archived thread keeps its original `archivedAt`. If a storage adapter doesn't persist `archivedAt`, `archiveThread` and `unarchiveThread` throw `MASTRA_MEMORY_THREAD_ARCHIVING_UNSUPPORTED` instead of reporting success.
