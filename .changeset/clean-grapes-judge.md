---
'@mastra/core': patch
---

Fixed durable and evented agent streams to use the plain-agent publisher while preserving owning-reader lifecycle management and preventing stale executions from overwriting run records.
