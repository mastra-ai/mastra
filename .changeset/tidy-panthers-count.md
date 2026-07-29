---
'@internal/core': patch
'@mastra/core': patch
---

Fixed `RequestContext.toJSON()` so deeply shared object graphs no longer block the event loop during serialization. Values that exceed the serialization safety limit are filtered instead.
