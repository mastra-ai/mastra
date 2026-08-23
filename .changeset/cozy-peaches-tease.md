---
'@mastra/core': patch
---

Fixed AI SDK `reasoning-file` and `custom` content parts being silently dropped from agent streams. Providers on the AI SDK v7 spec emit these parts, but Mastra discarded them when converting model output, so they never reached `fullStream` for either `generate` or `stream` calls. They now arrive as `reasoning-file` and `custom` chunks.

Content types Mastra does not recognize are no longer discarded either. They are now emitted as `raw` chunks, so you can see them by enabling raw chunks instead of losing the data with no error or warning:

```ts
const stream = await agent.stream('Hello', { includeRawChunks: true });

for await (const chunk of stream.fullStream) {
  if (chunk.type === 'raw') console.log(chunk.payload);
}
```
