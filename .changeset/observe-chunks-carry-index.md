---
'@mastra/core': patch
'@mastra/server': patch
'@mastra/client-js': patch
---

Agent stream chunks now carry `index`, their run-log position, so a client can resume `observe()` after a dropped connection without repeated or missing chunks. Chunks from `observe()` carry it on every agent, and chunks from `stream()` carry it on durable and evented agents, in core and over HTTP.

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

Callers that pass a run-log position, or replay from `offset: 0`, need no change. Callers that passed a count of received chunks as `offset` should switch to the last `index + 1`.
