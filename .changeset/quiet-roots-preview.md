---
'@mastra/clickhouse': patch
---

Trace and span lists use less memory. Every span now stores short previews of its input, output and error when it is written, so `queryTraces()`, `listTracesLight()` and `querySpans()` read those previews instead of each span's full payloads. Trace and span lists now also return `outputPreview` and `errorPreview`. Spans written before this change still show previews, built from their payloads.

The store adds `inputPreview`, `outputPreview` and `errorPreview` columns to `mastra_span_events`, `mastra_trace_roots` and `mastra_trace_branches` when it starts. No manual migration is needed.

Nonblank supplied previews are trimmed and capped like generated ones (100 characters plus `…`). Missing or blank write-time previews are generated through the optional core helper. Stored empty strings do not trigger read fallback. With older core versions that lack the helper, preview fields pass through unchanged without generation.
