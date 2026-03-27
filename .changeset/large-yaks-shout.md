---
'@mastra/duckdb': patch
---

Fixed `'Cannot create values of type ANY'` error when querying metrics endpoints with DuckDB. Parameter binding now uses explicit typed methods instead of relying on DuckDB's type inference, which fails for certain SQL contexts like `json_extract_string`.
