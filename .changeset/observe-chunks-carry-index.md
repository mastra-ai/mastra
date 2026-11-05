---
'@mastra/core': patch
'@mastra/server': patch
'@mastra/client-js': patch
---

Agent stream chunks now carry `index`, the run-log position they came from, so a client can resume `observe()` after a dropped connection without repeated or missing chunks. Chunks from `observe()` carry it on every agent, and chunks from `stream()` carry it on durable and evented agents, both in core and over the HTTP `/stream` and `/observe` endpoints. To resume, pass the last received chunk's `index + 1`:

```ts
let offset = 0;
const response = await agent.stream(messages, { runId });
await response.processDataStream({
  onChunk: async chunk => {
    if (chunk.index === undefined) return;
    offset = chunk.index + 1;
  },
});

// After a dropped connection:
const resumed = await agent.observe({ runId, offset });
await resumed.processDataStream({ onChunk: async chunk => console.log(chunk) });
```

Some chunks carry no `index`: structured-output `object` and `object-result` chunks are built locally, and an `abort` chunk is sent beside the `finish` of the same run-log entry, which carries the index. Resume from the last chunk that has an `index`. Indexed chunks are never repeated. A client that reconnects between an `abort` and its `finish` gets the `abort` again. A chunk whose replay-cache write failed, or any chunk when caching is off, is delivered live without an `index` and can't be replayed.

**Migration:** `index` is a new field and `offset` still means a run-log position, so existing callers need no change. Callers that pass a log position keep working, and replaying from `offset: 0` returns the same chunks in the same order as before, now with `index` set. Only callers that passed a count of chunks received were already getting repeated chunks after tool calls and step boundaries; switch those to the last `index + 1`.
