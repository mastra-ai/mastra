---
'@mastra/core': minor
---

Added `usedFallbackValue` to agent `generate()` and `stream()` results. With `structuredOutput.errorStrategy: 'fallback'`, `result.object` was previously indistinguishable from a real answer once the configured `fallbackValue` had been substituted: `finishReason` stayed `'stop'`, `tripwire` stayed empty, and the only marker was a `metadata.fallback` flag on the `object-result` chunk that only the structuring-model path emitted. Both paths now tag the chunk, and the result reports the substitution directly.

```ts
const result = await agent.generate('Summarize the ticket.', {
  structuredOutput: { schema, errorStrategy: 'fallback', fallbackValue: { summary: 'unknown', tags: [] } },
});

if (result.usedFallbackValue) {
  // result.object is the fallback, not something the model produced
}
```
