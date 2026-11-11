---
"@mastra/client-js": minor
---

Keep generated feedback/score IDs and timestamps stable across retries, expose optional response identity data, and preserve the caller's context mode selection or omission. Add bounded, cancellable retries for recognized missing-anchor responses and a full-replacement Platform feedback method.

```ts
await client.replaceFeedback({
  feedback: { feedbackId, traceId, timestamp, feedbackType: 'thumbs', value: -1 },
});
```

Preserve the original timestamp when replacing feedback. Each accepted PUT retry is a new replacement. OSS server does not yet implement this PUT endpoint.
