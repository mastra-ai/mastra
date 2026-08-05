---
'@internal/core': patch
'@mastra/core': patch
---

Fixed `RequestContext.toJSON()` so nested contexts reached through shared-reference graphs no longer block the event loop. The serialization safety budget is now shared across nested probes within one serialization, so such values are handled in bounded time — and filtered when they exceed the budget — instead of blocking for seconds.
