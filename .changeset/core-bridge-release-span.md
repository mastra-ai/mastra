---
'@mastra/core': patch
---

Added an optional `releaseSpan` method to the observability bridge interface.

Bridges hold per-span state from `createSpan()` until the span ends, but span-end events are only delivered for spans that survive export filtering, so a bridge had no way to learn that a filtered span had finished. `releaseSpan(spanId, traceId)` is now called for those spans. It is optional, so existing custom bridges continue to work unchanged.

Fixes [#20368](https://github.com/mastra-ai/mastra/issues/20368).
