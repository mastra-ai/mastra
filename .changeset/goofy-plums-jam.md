---
'@mastra/core': patch
---

Added regression coverage keeping memory-sourced messages exempt from the thread ID check, so resource-scoped observational memory can pull in messages from a resource's other threads without failing the turn.
