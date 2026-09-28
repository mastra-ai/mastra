---
'@mastra/core': patch
---

Fixed `DurableAgent` ignoring `savePerStep`. Each step is now saved to memory before the run continues, as with `Agent`, so a durable run that is interrupted mid-way keeps the steps it had already finished.

```ts
await durableAgent.stream('Research and summarize', {
  memory: { thread: 'thread-1', resource: 'user-1' },
  savePerStep: true,
});
```
