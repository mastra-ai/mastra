---
'@mastra/core': minor
---

Fixed agent streams closing silently when a provider ends the stream with `finishReason: 'error'` but sends no error payload (for example, Google models reporting `MALFORMED_FUNCTION_CALL`). Previously the stream closed with no error part and `onError` never fired, so a failed run looked identical to a turn that produced no text. The stream now emits an `error` chunk and calls `onError`, and error processors can intercept and retry the failure.

Added `stepResult.rawReason` to `step-finish` and `finish` chunks. It preserves the provider's own finish reason instead of collapsing it to `'error'`, so you can tell distinct provider failures apart:

```ts
for await (const chunk of stream.fullStream) {
  if (chunk.type === 'step-finish') {
    chunk.payload.stepResult.reason; // 'error'
    chunk.payload.stepResult.rawReason; // 'MALFORMED_FUNCTION_CALL'
  }
}
```

These runs previously resolved as if they had succeeded with empty output. They now fail the same way a provider-reported error already did: `agent.generate()` rejects, and so do awaited stream promises such as `stream.text`. Iterating `fullStream` still completes normally, with an `error` chunk included.
