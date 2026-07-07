---
'@mastra/duckdb': patch
---

Fixed listing lightweight traces on DuckDB storage. Calling `listTracesLight` on a DuckDB observability store previously threw "This storage provider does not support listing lightweight traces" because the lazy-loading store facade was missing the forwarding method, even though DuckDB fully supports the operation. The call now returns lightweight traces as expected. Fixes #18942.
