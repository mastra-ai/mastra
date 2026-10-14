---
'@mastra/clickhouse': patch
---

Trace and span lists use less memory. Every span now stores short previews of its input, output and error when it is written, so `queryTraces()`, `listTracesLight()` and `querySpans()` read those previews instead of each span's full payloads. Trace and span lists now also return `outputPreview` and `errorPreview`. Spans written before this change still show previews, built from their own payloads, even when another tenant has a root span with the same trace and span IDs.

`storage.init()` adds `inputPreview`, `outputPreview` and `errorPreview` columns to `mastra_span_events`, `mastra_trace_roots` and `mastra_trace_branches`. This runs automatically on first use. If you set `disableInit: true`, run `storage.init()` from your migration step before deploying, or apply the columns yourself. Add them to `mastra_trace_roots` and `mastra_trace_branches` before `mastra_span_events`, because the views that copy span events into those tables select every column:

```sql
ALTER TABLE mastra_trace_roots ADD COLUMN IF NOT EXISTS inputPreview Nullable(String);
ALTER TABLE mastra_trace_roots ADD COLUMN IF NOT EXISTS outputPreview Nullable(String);
ALTER TABLE mastra_trace_roots ADD COLUMN IF NOT EXISTS errorPreview Nullable(String);
ALTER TABLE mastra_trace_branches ADD COLUMN IF NOT EXISTS inputPreview Nullable(String);
ALTER TABLE mastra_trace_branches ADD COLUMN IF NOT EXISTS outputPreview Nullable(String);
ALTER TABLE mastra_trace_branches ADD COLUMN IF NOT EXISTS errorPreview Nullable(String);
ALTER TABLE mastra_span_events ADD COLUMN IF NOT EXISTS inputPreview Nullable(String);
ALTER TABLE mastra_span_events ADD COLUMN IF NOT EXISTS outputPreview Nullable(String);
ALTER TABLE mastra_span_events ADD COLUMN IF NOT EXISTS errorPreview Nullable(String);
```

On a replicated cluster, add `ON CLUSTER <cluster>` after each table name.

Nonblank supplied previews are trimmed and capped like generated ones (100 characters plus `…`). Missing or blank write-time previews are generated through the optional core helper. Stored empty strings do not trigger read fallback. With older core versions that lack the helper, preview fields pass through unchanged without generation.
