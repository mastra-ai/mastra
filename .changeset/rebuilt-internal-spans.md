---
'@mastra/observability': patch
'@mastra/core': patch
---

Fixed internal spans being exported after they are rebuilt with `rebuildSpan()`. Spans created with `tracingPolicy.internal` now keep their internal status through `exportSpan()` and `rebuildSpan()`, so durable engines such as `@mastra/inngest` no longer leak internal workflow step and loop spans into traces.
