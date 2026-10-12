---
'@mastra/duckdb': patch
---

Trace and span lists now read short stored previews instead of each span's full input. Every span event stores previews of its input, output and error when it is written, and `queryTraces()`, `listTracesLight()` and `querySpans()` read them. Lists also return `outputPreview` and `errorPreview`, and `querySpans()` adds `errorPreview` and `errorTruncated`.

Previews use the shared format from `@mastra/core`: at most 100 characters, ending with `…` when cut. For message lists they show the last user message. `querySpans()` previews used to be the first 256 characters of raw JSON. Spans written before this change still show previews, built from their payloads.

The store adds `inputPreview`, `outputPreview` and `errorPreview` columns to `span_events` when it starts. No manual migration is needed.
