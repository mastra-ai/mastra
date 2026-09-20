---
'@mastra/core': minor
---

Added `usedFallbackValue` to agent `generate()` and `stream()` results. With `structuredOutput.errorStrategy: 'fallback'`, `result.object` was previously indistinguishable from a real answer once the configured `fallbackValue` had been substituted: `finishReason` stayed `'stop'`, `tripwire` stayed empty, and the only marker was a `metadata.fallback` flag on the internal `object-result` chunk, which never reached the result. The result — and the `onFinish` callback payload — now report the substitution directly, for both the native and separate-structuring-model paths.

```ts
const result = await agent.generate('Summarize the ticket.', {
  structuredOutput: { schema, errorStrategy: 'fallback', fallbackValue: { summary: 'unknown', tags: [] } },
});

if (result.usedFallbackValue) {
  // result.object is the fallback, not something the model produced
}
```
