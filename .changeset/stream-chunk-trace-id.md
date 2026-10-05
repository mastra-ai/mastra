---
'@mastra/core': minor
---

Added `traceId` to agent stream chunks, next to `runId`. Clients that call `/stream` can now link a run to its trace without switching to `/generate`. The field is undefined when tracing is disabled. Custom `data-*` chunks (for example, from `writer.custom()`) are left exactly as written and don't include `traceId`. Fixes [#25811](https://github.com/mastra-ai/mastra/issues/25811).

```ts
const stream = await agent.stream('hi');
for await (const chunk of stream.fullStream) {
  console.log(chunk.runId, chunk.traceId);
}
```
