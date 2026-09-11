---
'@mastra/core': patch
'@mastra/memory': patch
'@mastra/libsql': patch
'@mastra/pg': patch
---

Avoid loading every message payload into the Node heap when cloning a thread for a forked subagent.

`memory.cloneThread()` previously parsed and accumulated all source message payloads into memory, then discarded them on the fork path where only the new thread id is needed. `StorageCloneThreadInput.options` now accepts `hydrateMessages` (default `true`); when `false`, the LibSQL, Postgres, and in-memory adapters copy message rows inside the database via `INSERT … SELECT` and return an empty `clonedMessages` array. `Memory.cloneThread` re-enables hydration when semantic recall is active so embeddings still work, and forked subagents now clone with `hydrateMessages: false`. Fixes #23434.

Callers can opt into lazy hydration directly:

```ts
const { messageIdMap } = await memory.cloneThread({
  sourceThreadId,
  newThreadId,
  resourceId,
  options: { hydrateMessages: false },
});
```
