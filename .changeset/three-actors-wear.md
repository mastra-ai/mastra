---
'@mastra/client-js': minor
---

Support OSS feedback replacement requests and the `feedbackReplacement` capability.

```typescript
await client.replaceFeedback({
  feedback: {
    feedbackId: 'feedback-1',
    traceId: 'trace-123',
    timestamp: '2026-11-11T12:00:00.123Z',
    feedbackType: 'thumbs',
    value: -1,
  },
});
```
