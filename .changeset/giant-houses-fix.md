---
'@mastra/observability': minor
---

Add feedback review-status delivery to storage and Platform exporters. Each supporting destination handles its own update, without depending on local storage. Flush and shutdown wait for pending updates.

```typescript
await observability.updateFeedbackReviewStatus({
  feedbackId: 'feedback-123',
  reviewStatus: 'reviewed',
});
await observability.flush();
```
