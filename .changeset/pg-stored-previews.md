---
'@mastra/pg': patch
---

Trace and span lists now read short stored previews instead of each span's full input. Every span stores previews of its input, output and error when it is written, and `queryTraces()` and `querySpans()` read them. Lists also return `outputPreview` and `errorPreview`, and `querySpans()` adds `errorPreview` and `errorTruncated`.

Generated previews use the shared format from `@mastra/core`: at most 100 characters plus `…` when cut. For message lists they show the last user message. `querySpans()` previews used to be the first 256 characters of raw JSON. Nonblank supplied previews are trimmed and capped the same way; missing or blank write-time previews are generated from their payloads.

`listTracesLight()` also reads stored previews. NULL previews trigger batched payload reads and application-side generation; stored empty strings do not. With older core versions that lack the optional preview helper, preview fields pass through unchanged without generation.

`storage.init()` adds `inputPreview`, `outputPreview` and `errorPreview` columns to `mastra_span_events`. This runs automatically on first use. If you set `disableInit: true`, run `storage.init()` from your migration step before deploying, or apply the columns yourself (use your schema name if it isn't `public`):

```sql
ALTER TABLE "public"."mastra_span_events" ADD COLUMN IF NOT EXISTS "inputPreview" text;
ALTER TABLE "public"."mastra_span_events" ADD COLUMN IF NOT EXISTS "outputPreview" text;
ALTER TABLE "public"."mastra_span_events" ADD COLUMN IF NOT EXISTS "errorPreview" text;
```
