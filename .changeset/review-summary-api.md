---
'@mastra/server': patch
'@mastra/client-js': patch
---

Added experiment review summary API endpoint and client SDK method.

- **Server**: New `GET /experiments/review-summary` endpoint that returns aggregated review status counts (`needsReview`, `reviewed`, `complete`) per experiment, with totals.
- **Client SDK**: New `getExperimentReviewSummary()` method and `ExperimentReviewCounts` type for querying the review pipeline state from the client.
