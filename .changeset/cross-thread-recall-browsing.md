---
'@mastra/memory': minor
'@mastra/core': patch
---

feat(memory): add recall-tool history retrieval for agents using observational memory

Agents that use observational memory can now use the `recall` tool to retrieve history from past conversations, including raw messages, thread listings, and indexed observation-group memories.

Enable observational-memory retrieval when listing tools:

```ts
const tools = await memory.listTools({
  threadId: 'thread_123',
  resourceId: 'resource_abc',
  observationalMemory: {
    retrieval: { vector: true, scope: 'resource' },
  },
});
```

With retrieval enabled, `recall` can browse the current thread, list threads for the current resource, and search indexed observation groups with source ranges.
