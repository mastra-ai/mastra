---
'@mastra/core': patch
---

Calling `abort()` with no reason from an output processor's `processOutputStream` now reports `Tripwire triggered by <processorId>` on durable and evented agents, the same as `Agent.stream()` and every other processor hook. Before this fix those engines reported `Stream part blocked by <processorId>`.
