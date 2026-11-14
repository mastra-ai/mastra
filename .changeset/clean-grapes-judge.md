---
'@mastra/core': patch
---

Fixed durable and evented agent streams so run status and replay cleanup follow the execution that owns the stream, including when a run ID is reused. Existing durable replay records remain readable after upgrading.
