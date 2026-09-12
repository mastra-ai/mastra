---
'@mastra/core': patch
'@mastra/memory': patch
'@mastra/libsql': patch
'@mastra/pg': patch
---

Added `copyThread()` so a thread and its messages can be duplicated without loading every message payload into the Node heap. Fixes #23434.

`memory.cloneThread()` keeps its existing signature and still returns `clonedMessages`, but the copy now happens inside the database first (via `INSERT … SELECT` on LibSQL and Postgres) and the messages are read back afterwards only because the caller asked for them. Forked subagents and other callers that only need the new thread id use the new `memory.copyThread()`, which never returns message content. When semantic recall is enabled, the copied messages are still read back to generate embeddings, but in batches of 100 instead of all at once.

```ts
// Same as before: returns the copied messages.
const { thread: clonedThread, clonedMessages } = await memory.cloneThread({ sourceThreadId });

// New: copy without returning message payloads.
const { thread: copiedThread, messageIdMap } = await memory.copyThread({ sourceThreadId });
```

Storage adapters now implement `copyThread()`; the base `cloneThread()` is derived from it. The unreleased `hydrateMessages` option has been removed.
