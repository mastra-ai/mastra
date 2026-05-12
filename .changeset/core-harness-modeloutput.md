---
'@mastra/core': patch
---

A tool's `toModelOutput` result is now computed before the `tool-result` chunk is emitted, so it travels with the chunk on `providerMetadata.mastra.modelOutput`. Previously `toModelOutput` only ran later when the message list was updated, meaning live stream consumers couldn't see it without re-running the tool.

The harness now forwards that `providerMetadata` on `tool_result` content (both streaming and replayed history) and on `tool_end` events, so UIs can render rich tool output (e.g. screenshot images) inline.

```ts
harness.on('tool_end', event => {
  const modelOutput = event.providerMetadata?.mastra?.modelOutput;
  // e.g. { type: 'content', value: [{ type: 'image-data', mediaType: 'image/png', data: '...' }] }
});
```
