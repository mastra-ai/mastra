---
'@mastra/duckdb': patch
---

Spans stored in DuckDB now keep the parent span ID from your outside tracing system (for example OpenTelemetry) as `externalParentSpanId`. The store adds the column to `span_events` when it starts, so no manual migration is needed.

A trace with several top-level runs now shows once in trace lists, under its earliest run, and `getRootSpan()` returns that run. When you filter by a value that only a later run has, the trace still shows, under that run. A later run that is still running no longer hides the trace.
