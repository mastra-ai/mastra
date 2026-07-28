---
'@mastra/core': minor
---

Fixed agent streams closing silently when a provider ends the stream with `finishReason: 'error'` but sends no error payload. Google reports `MALFORMED_FUNCTION_CALL` this way, intermittently, on large tool schemas with models like `google/gemini-2.5-flash`. Mastra logged the failure on the server, but the client stream closed with no error part and `onError` never fired — the run looked identical to a turn that produced no text, while tokens were still billed.

The stream now emits an `error` chunk and calls `onError` for this case, routed through the same path as a provider-supplied error part, so error processors can intercept and retry it. The provider's own finish reason is preserved as the new `stepResult.rawReason` field instead of being collapsed to `'error'`, so you can tell distinct provider failures apart:

```ts
const stream = await agent.stream('Analyze this data', {
  onError: ({ error }) => console.error(error.message),
});

for await (const chunk of stream.fullStream) {
  if (chunk.type === 'error') {
    chunk.payload.error.details.rawFinishReason; // 'MALFORMED_FUNCTION_CALL'
  }

  if (chunk.type === 'step-finish') {
    chunk.payload.stepResult.reason; // 'error'
    chunk.payload.stepResult.rawReason; // 'MALFORMED_FUNCTION_CALL'
  }
}
```

**Behavior change:** these runs previously resolved as if they had succeeded with empty output. They now fail the same way a provider-reported error already did: `agent.generate()` rejects, and so do awaited stream result promises such as `stream.text`. Iterating `fullStream` still completes normally, with an `error` chunk included. If you depended on these runs resolving silently, handle the rejection or check `stepResult.reason` instead.
