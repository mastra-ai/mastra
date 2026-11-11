---
"@mastra/client-js": minor
---

Required `traceId` in the request types for `createFeedback()` and `createScore()`. Callers that previously omitted the trace ID must now supply it. `spanId` remains optional, and response types are unchanged.

Before:

```ts
await client.createScore({ score: { scorerId: 'accuracy', score: 0.9 } });
```

After:

```ts
await client.createScore({ score: { traceId: 'trace-123', scorerId: 'accuracy', score: 0.9 } });
await client.createFeedback({ feedback: { traceId: 'trace-123', feedbackType: 'thumbs', value: 1 } });
```
