---
'@mastra/core': patch
---

Added `transient` option for data chunks to skip database persistence. Chunks marked as transient are streamed to the client for live display but not saved to storage, reducing bloat from large streaming outputs.

```ts
await context.writer?.custom({
  type: 'data-my-stream',
  data: { output: line },
  transient: true,
});
```

Workspace tools now use this to mark stdout/stderr streaming chunks as transient.
