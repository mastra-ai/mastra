---
'@mastra/core': minor
---

Fixed agent streams closing silently when a provider ends the stream with `finishReason: 'error'` but sends no error payload.

Some providers signal a failed generation only through the finish reason. Google reports `MALFORMED_FUNCTION_CALL` this way, which happens intermittently on large tool schemas with models like `google/gemini-2.5-flash`. Mastra logged the failure on the server, but the client stream closed with no error part and `onError` never fired, so the run looked identical to a turn that simply produced no text — while tokens were still billed.

The stream now emits an `error` chunk and calls `onError` for this case. The provider's own finish reason is also preserved as `rawReason` instead of being collapsed to `'error'`, so you can tell distinct provider failures apart.

**Before** — the failure was invisible to the client:

```ts
const stream = await agent.stream('Analyze this data');

for await (const chunk of stream.fullStream) {
  // 'start', 'step-start', 'step-finish', 'finish'
  // no text, no error — indistinguishable from a quiet turn
}
```

**After** — the failure surfaces, with the provider's reason intact:

```ts
const stream = await agent.stream('Analyze this data', {
  onError: ({ error }) => {
    // Agent stream finished with finishReason "error"
    // (provider reported "MALFORMED_FUNCTION_CALL")
    // but no error payload was provided
    console.error(error.message);
  },
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

This routes through the same path as a provider-supplied error part, so error processors now run for this case too and a `processAPIError` handler can retry it.

**Behavior change:** these runs previously resolved as if they had succeeded with empty output. They now fail the same way a provider-reported error already did:

```ts
// Previously: resolved with text '' and finishReason 'error'
// Now: throws, matching what happens when a provider sends an error payload
const result = await agent.generate('Analyze this data');

// Same for awaited stream promises
const stream = await agent.stream('Analyze this data');
await stream.text; // now rejects instead of resolving to ''
```

Iterating `fullStream` still completes normally, with an `error` chunk included. If you depended on these runs resolving silently, handle the rejection or inspect `stepResult.reason` instead.
