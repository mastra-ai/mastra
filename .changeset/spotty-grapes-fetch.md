---
'@mastra/playground-ui': patch
'@mastra/client-js': patch
'@mastra/memory': patch
'@mastra/server': patch
'@mastra/upstash': patch
'@mastra/core': patch
'@mastra/libsql': patch
'@mastra/pg': patch
---

Adds thread cloning to create independent copies of conversations that can diverge.

```typescript
// Clone a thread
const { thread, clonedMessages } = await memory.cloneThread({
  sourceThreadId: 'thread-123',
  title: 'My Clone',
  options: {
    messageLimit: 10, // optional: only copy last N messages
  },
});

// Check if a thread is a clone
if (memory.isClone(thread)) {
  const source = await memory.getSourceThread(thread.id);
}

// List all clones of a thread
const clones = await memory.listClones('thread-123');
```

Includes:

- Storage implementations for InMemory, PostgreSQL, LibSQL, Upstash
- API endpoint: `POST /api/memory/threads/:threadId/clone`
- Embeddings created for cloned messages (semantic recall)
- Clone button in playground UI Memory tab
