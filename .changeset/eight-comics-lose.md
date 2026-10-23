---
'@mastra/observability': patch
---

Changed `@mastra/observability` to reuse the token usage normalizer from `@mastra/core`. `extractUsageMetrics` is still exported and behaves the same. This release needs `@mastra/core` 1.80.0 or newer.
