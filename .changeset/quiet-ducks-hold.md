---
'@mastra/duckdb': patch
---

Reduced memory use when reading spans that carry large inputs or outputs ([#25518](https://github.com/mastra-ai/mastra/issues/25518)).

DuckDB loads every large value stored near a requested span when those values sit next to empty ones. Fetching one span or one trace page could therefore load hundreds of megabytes. New spans store missing `input`, `output`, `attributes` and `requestContext` values to avoid this. On a store with large agent payloads, reading one span went from about 316 MB to about 1 MB. The oldest trace page went from about 469 MB to about 145 MB.

Results are unchanged. Spans written by earlier versions read the same as before and keep the old memory use until they are pruned.
