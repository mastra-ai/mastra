---
'@mastra/duckdb': patch
---

Reduced storage use for ended spans in `@mastra/duckdb`. Span data returned by queries is unchanged. Fixes #25240.
