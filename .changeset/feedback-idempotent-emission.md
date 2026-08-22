---
'@mastra/observability': patch
---

Feedback recorded through `addFeedback()` now respects a client-supplied `feedbackId` instead of always generating one, enabling idempotent retries that do not create duplicate feedback records.
