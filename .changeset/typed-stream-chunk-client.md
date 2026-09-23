---
'@mastra/client-js': minor
---

`StreamVNextChunkType`, the chunk type of workflow run streams, is now the workflow stream event type from `@mastra/core` instead of `{ type: string; payload: any }`. Custom events sent with `writer.custom()` carry `data` and no `payload`, so check `type` before reading `payload`:

```ts
// Before: compiled, then threw on the first custom event
const stream = await run.observe();
for await (const chunk of stream) {
  console.log(chunk.payload.id);
}

// After
for await (const chunk of stream) {
  if (chunk.type === 'workflow-step-result') {
    console.log(chunk.payload.id);
  }
}
```
