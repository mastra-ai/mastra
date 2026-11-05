---
'@mastra/core': patch
'@mastra/server': patch
'@mastra/client-js': patch
---

Agent stream chunks now carry `index`, the run-log position they came from, so a client can resume `observe()` after a dropped connection without repeated or missing chunks. Chunks from `observe()` carry it on every agent, and chunks from `stream()` carry it on durable and evented agents, both in core and over the HTTP `/stream` and `/observe` endpoints. To resume, pass the last received chunk's `index + 1`:

```ts
let lastIndex: number | undefined;
const response = await agent.stream(messages, { runId });
await response.processDataStream({
  onChunk: async chunk => {
    if (chunk.index !== undefined) lastIndex = chunk.index;
  },
});

// After a dropped connection:
await agent.observe({ runId, offset: lastIndex === undefined ? 0 : lastIndex + 1 });
```

An `abort` chunk shares its index with the `finish` chunk that follows it. If the last chunk received was `abort`, pass its `index` to receive both again.

Resuming a finished plain (non-durable) agent run past its last chunk over HTTP `/observe` now closes the stream right away instead of waiting for the idle timeout.

**Migration:** `index` is a new field and `offset` still means a run-log position, so existing callers need no change. Callers that pass a log position keep working, and replaying from `offset: 0` returns the same chunks in the same order as before, now with `index` set. Only callers that passed a count of chunks received were already getting repeated chunks after tool calls and step boundaries; switch those to the last `index + 1`.
