---
'@mastra/clickhouse': patch
---

Reduced the memory `queryTraces()` uses to list traces. Root spans now store their input preview when they are written, so trace lists read that short preview instead of each trace's full input. Traces written before this change still show the same preview, built from their input.

The store adds an `inputPreview` column to `mastra_span_events`, `mastra_trace_roots` and `mastra_trace_branches` when it starts. No manual migration is needed.
