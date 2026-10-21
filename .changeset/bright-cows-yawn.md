---
'@mastra/core': patch
---

Reduced durable agent snapshot size: tool results are no longer stored twice per step, so long-running durable agents with large tool outputs write much smaller snapshots. `stopWhen` conditions still receive the full step content.
