---
'@mastra/core': patch
---

Fixed durable and evented agents that share a pubsub deadlocking after a tool-call step. Standalone agents on the same event bus now share a single workflow worker set, so multi-step runs continue to completion instead of hanging.
