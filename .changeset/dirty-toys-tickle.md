---
'@mastra/core': minor
'@mastra/server': minor
'@mastra/client-js': minor
---

Added a review workflow status to observability feedback.

- Feedback records now carry a `reviewStatus` (`needs-review` | `reviewed`), defaulting to `needs-review` and settable at creation; `listFeedback` can filter on it.
- New storage method `updateFeedbackReviewStatus` and `PATCH /api/observability/feedback/:feedbackId/review-status` endpoint (requires `observability:write`), exposed on the client as `updateFeedbackReviewStatus`.

```ts
const { feedback } = await client.listFeedback({
  filters: { reviewStatus: 'needs-review' },
  pagination: { page: 0, perPage: 20 },
});

await client.updateFeedbackReviewStatus({
  feedbackId: feedback[0].feedbackId,
  reviewStatus: 'reviewed',
});
```
