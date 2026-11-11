---
'@mastra/core': minor
---

Add optional review-status update methods for observability exporters. Unsupported exporters skip these updates safely.

```typescript
await mastra.observability.updateFeedbackReviewStatus?.({
  feedbackId: 'feedback-123',
  reviewStatus: 'reviewed',
});
await mastra.observability.flush();
```
