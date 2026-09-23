---
'@mastra/duckdb': minor
---

Applied the trusted tenant scope of advanced trace queries to root spans, related spans, scores, feedback, and discovery scans. The store advertises the `trace-query-tenant-scope` feature so the server can reject scoped requests against older stores.
