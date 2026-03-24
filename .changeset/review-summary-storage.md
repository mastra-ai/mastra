---
'@mastra/core': patch
'@mastra/libsql': patch
'@mastra/pg': patch
---

Added `getReviewSummary()` method to the experiments storage domain for aggregating review pipeline status across experiment results.

Returns per-experiment counts of `needs-review`, `reviewed`, and `complete` items, enabling the Evaluation dashboard to display review pipeline health without expensive client-side fan-out queries.
