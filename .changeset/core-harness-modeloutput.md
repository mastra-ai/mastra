---
'@mastra/core': patch
---

Harness consumers can now read a tool's `toModelOutput` result directly from `tool_result` content and `tool_end` events without re-running the tool. The harness now forwards the full `providerMetadata` (including `mastra.modelOutput`) on streaming chunks, replayed history, and `tool_end` events — so UIs can render rich tool output (e.g. screenshot images) inline.

```ts
harness.on('tool_end', event => {
  const modelOutput = event.providerMetadata?.mastra?.modelOutput;
  // e.g. { type: 'content', value: [{ type: 'image-data', mediaType: 'image/png', data: '...' }] }
});
```
