---
'@mastra/duckdb': patch
---

Fixed trace list pages and trace queries that loaded most of the observability table and could fail with an out-of-memory error ([#25518](https://github.com/mastra-ai/mastra/issues/25518)).

- `listTraces`, `listTracesLight` and `listBranches` now read only the page's own spans. Oldest-first pages, such as the ones a retention job reads, no longer load the whole table.
- `queryTraces` reads only traces whose root spans fall in the requested time range, including when it filters on related spans.

On a 100k-trace store, the oldest `listTraces` page went from loading about 1.9 GB of table data to about 32 MB, and `queryTraces` from about 860 MB to about 25 MB. Results are unchanged.
