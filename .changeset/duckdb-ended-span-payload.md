---
'@mastra/duckdb': patch
---

Reduced DuckDB observability storage for ended spans. When a span ends, it is written again, and the extra start row that write adds no longer repeats the span's input, attributes, metadata and request context. The end row already stores these values, so spans read back exactly as before. Fixes #25240.
