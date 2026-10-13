---
'@mastra/duckdb': patch
---

Trace and span lists now read short stored previews instead of each span's full input. Every span event stores previews of its input, output and error when it is written, and `queryTraces()`, `listTracesLight()` and `querySpans()` read them. Lists also return `outputPreview` and `errorPreview`, and `querySpans()` adds `errorPreview` and `errorTruncated`.

Generated previews use the shared format from `@mastra/core`: at most 100 characters plus `…` when cut. For message lists they show the last user message. `querySpans()` previews used to be the first 256 characters of raw JSON. Nonblank supplied previews are trimmed without a length limit; missing or blank write-time previews are generated from their payloads.

Reconstructed previews stay aligned with the event carrying their payload, including newer empty or missing previews. NULL previews trigger batched payload reads and application-side generation; stored empty strings do not. With older core versions that lack the optional preview helper, preview fields pass through unchanged without generation.

The store adds `inputPreview`, `outputPreview` and `errorPreview` columns to `span_events` when it starts. No manual migration is needed.
