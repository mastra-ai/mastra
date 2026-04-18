---
'@mastra/observability': patch
---

Skip deepClean on spans that will be dropped before export. Previously, excludeSpanTypes and the internal-span filter only took effect at export time, so BaseSpan still serialized attributes, metadata, requestContext, input, and output on every construct/end/update/error — even for spans that would never leave the process. This was a hot-path cost on streaming (per-chunk MODEL_CHUNK spans). deepClean is now short-circuited when excludeSpanTypes drops the type, when the span is internal and includeInternalSpans is false, or for NoOpSpans.
