---
'@mastra/duckdb': patch
---

Improved performance of `listTraces` and `listBranches` on DuckDB. The Traces and Branches lists in the observability UI now load noticeably faster, especially on large span tables, because filtering and pagination happen up front and the store only assembles full span data for the rows on the page being viewed.

No API or behavior changes — return shapes and filter semantics are unchanged, and no migration is required.
