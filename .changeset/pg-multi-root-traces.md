---
'@mastra/pg': patch
---

Stored spans now keep the parent span ID from your outside tracing system as `externalParentSpanId`. Existing span tables get the new column when the store starts.

A trace with several top-level runs, such as one outside request that calls several agents, now shows once in trace lists, under its earliest run. Filters match the trace through any of its runs. `getRootSpan()` returns the earliest run instead of throwing on such traces.
