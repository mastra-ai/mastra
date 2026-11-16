---
'@mastra/core': patch
---

Fixed durable and evented agent streams so cleanup and completion from an earlier execution preserve a newer run using the same run ID.
