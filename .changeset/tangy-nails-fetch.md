---
'@mastra/observability': patch
---

Spans that will be filtered out before export no longer retain heavy payload data. Previously, excludeSpanTypes and the internal-span filter only took effect at export time, so BaseSpan still serialized and held references to attributes, input, output, errorInfo, and requestContext on every construct/end/update/error — even for spans that would never leave the process. This was a hot-path cost on streaming (per-chunk MODEL_CHUNK spans). These fields are now skipped entirely when excludeSpanTypes drops the type, when the span is internal and includeInternalSpans is false, or for NoOpSpans. Metadata is still attached and deep-cleaned because correlation, logger, and metrics contexts read it in process. Live reads of `attributes` on a filtered span now return `{}` and `input`/`output`/`errorInfo`/`requestContext` return `undefined`; exported span data is unchanged.
