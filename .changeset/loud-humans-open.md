---
'@mastra/core': minor
---

Added model timeout settings so agent runs can limit total runtime and per-step model calls.

```ts
await agent.generate('Write a report', {
  modelSettings: {
    timeout: {
      totalMs: 60_000,
      stepMs: 10_000,
    },
  },
});
```
