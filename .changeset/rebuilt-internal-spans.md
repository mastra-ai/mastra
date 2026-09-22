---
'@mastra/observability': patch
'@mastra/core': patch
---

Fixed internal spans being exported after they are rebuilt with `rebuildSpan()` when `includeInternalSpans` is disabled. Spans created with `tracingPolicy.internal` now keep their internal status through `exportSpan()` and `rebuildSpan()`, so they stay out of exporters by default and remain included when `includeInternalSpans` is enabled.
