---
"@mastra/core": minor
---

Add optional context mode, timestamp, and response identity fields to HTTP feedback/score types. Preserve an explicit null feedback author in storage without substituting the span user; omitted legacy storage attribution remains supported.

```ts
await observability.createFeedback({
  feedback: {
    feedbackId: "feedback-1",
    timestamp: new Date(),
    traceId: "trace-123",
    feedbackType: "thumbs",
    value: 1,
    userId: "span-user",
    feedbackUserId: null, // Anonymous author; the span user stays separate.
  },
});
```
