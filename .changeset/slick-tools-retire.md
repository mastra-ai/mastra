---
'@mastra/observability': minor
'@mastra/core': patch
---

Token and cost metrics now carry a `usageId` shared by all rows from the same model call. Usage rolled up from hidden model calls onto a visible span gets a separate `usageId` per call, so each call stays distinguishable even though the rows share a span.
