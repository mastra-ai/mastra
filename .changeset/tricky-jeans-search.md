---
'@mastra/core': minor
---

Added `completionStartTime` to agent run and model step span attributes, a `getTimeToFirstChunkMs()` helper that derives time to first chunk for any span, and carried the first-chunk clock through durable and evented agent runs so their generation and agent run spans report it too.
