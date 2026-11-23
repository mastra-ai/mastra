---
'@mastra/core': patch
---

Accept `retrieval.searchTimeoutMs` in Observational Memory options, so an agent's per-call memory options and stored agent configs can set how long recall search waits.

```ts
await agent.generate('What did we decide about deploys?', {
  memory: {
    thread: 'thread-1',
    resource: 'user-1',
    options: { observationalMemory: { retrieval: { vector: true, searchTimeoutMs: 60_000 } } },
  },
});
```
