---
'@mastra/core': patch
---

Reuse native memory reads within durable preparation and rebuild fresh read state during cold recovery. Keep later requests, ownership checks and serialized workflow state separate.
