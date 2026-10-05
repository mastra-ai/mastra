---
'@mastra/duckdb': patch
---

Reduced memory use when reading spans that carry large inputs or outputs ([#25518](https://github.com/mastra-ai/mastra/issues/25518)).

DuckDB loads every large value stored near a requested span whenever those values sit next to empty ones, so fetching one span or one trace page could load hundreds of megabytes. Spans written from now on store missing `input`, `output`, `attributes` and `requestContext` values in a way that avoids this. On a store with large agent payloads, reading one span went from loading about 316 MB to about 1 MB, and the oldest trace page from about 469 MB to about 145 MB.

Results are unchanged. Spans written by earlier versions read the same as before and keep the old memory use until they are pruned.
