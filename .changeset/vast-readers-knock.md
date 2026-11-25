---
'@mastra/core': patch
---

Preserve live request context for durable agent processors and callbacks when evented steps run on the owning Mastra instance, including with Redis Streams.
