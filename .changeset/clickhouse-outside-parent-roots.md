---
'@mastra/clickhouse': patch
---

Stored spans now keep the parent span ID from your outside tracing system as `externalParentSpanId`. Existing tables get the new column when the store starts.

A trace with several top-level runs now shows once in trace lists, under its earliest run. Sorting and paging use that run. Filters match the trace through any of its runs.
