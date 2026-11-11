---
"@mastra/core": minor
---

Required a nonblank `traceId` in the feedback and score HTTP body schemas. Missing, null, empty, and whitespace-only IDs are rejected. Storage creation, batch APIs, and historical nullable records are unchanged.

Before, HTTP callers could omit the trace:

```ts
await client.createFeedback({ feedback: { feedbackType: 'thumbs', value: 1 } });
```

Now, supply its ID. `spanId` remains optional:

```ts
await client.createFeedback({ feedback: { traceId: 'trace-123', feedbackType: 'thumbs', value: 1 } });
await client.createScore({ score: { traceId: 'trace-123', scorerId: 'accuracy', score: 0.9 } });
```
