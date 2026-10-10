---
'@mastra/core': minor
'@mastra/observability': patch
---

Added an optional `usageId` field to exported metrics. Every token and cost metric produced from the same model usage shares one `usageId`, so storage can group a model call's metric rows without relying on the span. Other metrics leave it unset.
