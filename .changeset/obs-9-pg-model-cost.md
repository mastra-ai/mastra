---
'@mastra/pg': minor
---

Added PostgreSQL support for filtering and ordering trace queries by `modelCost`, and for returning it in the table summary. The store rolls up the trace's total-token metric costs once per query, keeps unavailable costs as `NULL`, and pages cost ordering deterministically with `traceId` as the tie-breaker.
