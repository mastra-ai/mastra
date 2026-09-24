---
'@mastra/duckdb': patch
---

Fixed `listTraces`, `listTracesLight` and `listBranches` on `@mastra/duckdb` so each trace and branch is counted once. Every ended span is stored with two start rows, and the fast path and delta polling counted both. `pagination.total` was double the real number, each page returned about half of `perPage`, a trace could show on two pages, and delta polls returned every trace twice. Fixes https://github.com/mastra-ai/mastra/issues/24919
