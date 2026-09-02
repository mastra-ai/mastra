---
'@mastra/pg': patch
'@mastra/duckdb': patch
---

Add `reviewStatus` support to observability feedback storage: new column with migration (defaults to `needs-review`), read/write mapping, `reviewStatus` list filtering, and `updateFeedbackReviewStatus` implementation.
