---
'@mastra/core': patch
'@mastra/server': patch
'@mastra/client-js': patch
---

Fixed resuming a durable or evented agent stream after a dropped connection repeating chunks. Resuming with `offset` set to the number of chunks already received landed too early after tool calls and step boundaries, because `offset` counts run-log entries and some entries send no chunk. Every chunk from `stream()` and `observe()`, including the HTTP `/stream` and `/observe` endpoints, now carries the log position it came from as `index`. To resume, pass the last received chunk's `index + 1`:

```ts
let lastIndex: number | undefined;
const response = await agent.stream(messages, { runId });
await response.processDataStream({
  onChunk: async chunk => {
    lastIndex = chunk.index;
  },
});

// After a dropped connection:
await agent.observe({ runId, offset: lastIndex === undefined ? 0 : lastIndex + 1 });
```

An `abort` chunk shares its index with the `finish` chunk that follows it. If the last chunk received was `abort`, pass its `index`.

The meaning of `offset` doesn't change, so callers that already pass a log position keep working. Callers that pass a count of chunks received should switch to `index + 1`. Replaying from `offset: 0` returns the same chunks as before, now with `index` set.
