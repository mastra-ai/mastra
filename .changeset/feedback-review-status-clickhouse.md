---
'@mastra/clickhouse': patch
---

Added `reviewStatus` support to observability feedback storage so feedback can be listed by review state and marked as reviewed. Existing rows default to `needs-review`; updates are append-only (a new row is inserted and reads use `FINAL`).

```ts
const { feedback } = await storage.listFeedback({ filters: { reviewStatus: 'needs-review' } });
await storage.updateFeedbackReviewStatus({ feedbackId: feedback[0].feedbackId, reviewStatus: 'reviewed' });
```
