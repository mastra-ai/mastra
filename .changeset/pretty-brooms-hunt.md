---
'@mastra/observability': minor
---

Add feedback replacement delivery through supporting exporters. `MastraPlatformExporter` sends PUT requests, while storage exporters persist their copies independently. Flush and shutdown drain pending replacements.

```typescript
await observability.replaceFeedback({
  traceId: 'trace-123',
  feedback: {
    feedbackId: 'feedback-1',
    timestamp: new Date('2026-11-11T12:00:00.123Z'),
    feedbackType: 'thumbs',
    value: -1,
  },
});
```
