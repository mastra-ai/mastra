---
'@mastra/core': patch
---

When sending the first message to a new thread with PostgresStore, users would get a "Thread not found" error. This happened because the thread was created in memory but not persisted to the database before the MessageHistory output processor tried to save messages.

**Before:**

```ts
threadObject = await memory.createThread({
  // ...
  saveThread: false, // thread not in DB yet
});
// Later: MessageHistory calls saveMessages() -> PostgresStore throws "Thread not found"
```

**After:**

```ts
threadObject = await memory.createThread({
  // ...
  saveThread: true, // thread persisted immediately
});
// MessageHistory can now save messages without error
```
