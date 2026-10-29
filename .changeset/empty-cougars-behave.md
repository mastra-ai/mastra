---
'@mastra/playground-ui': minor
---

Added an Outcome column to the Traces and Spans tables in Studio. Each row shows how the run ended (for example `Limit · max_steps`), with the stop reason context on hover. Rows without a recorded outcome show their error-based status, muted, with a note that the outcome was not recorded.

Added Outcome and Stop reason filters to the Traces and Spans filter bars, including an "is not recorded" option for runs without an outcome. The filters appear only when the storage can filter on these fields.

Filter bar fields can now relabel an operator with `operatorLabels`, for example `{ notExists: 'is not recorded' }`.
