---
'@mastra/observability': patch
'@mastra/core': patch
---

Fixed internal spans being exported after they are rebuilt with `rebuildSpan()`. Spans created with `tracingPolicy.internal` now keep their internal status through `exportSpan()` and `rebuildSpan()` so internal spans stay out of exporters even when they are rebuilt from exported data.
