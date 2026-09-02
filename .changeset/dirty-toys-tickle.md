---
'@mastra/core': minor
'@mastra/server': minor
'@mastra/client-js': minor
---

Added a review workflow status to observability feedback.

- Feedback records now carry a `reviewStatus` (`needs-review` | `reviewed`), defaulting to `needs-review` and settable at creation; `listFeedback` can filter on it.
- New storage method `updateFeedbackReviewStatus` and `PATCH /api/observability/feedback/:feedbackId/review-status` endpoint, exposed on the client as `updateFeedbackReviewStatus`.
- Studio thumbs up/down ratings from experiment review are created as `reviewed` so they don't show up in the inbox.
