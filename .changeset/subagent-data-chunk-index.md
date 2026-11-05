---
'@mastra/core': patch
---

A durable sub-agent's run-log `index` is not copied onto the parent agent's stream, where it would read as a position in the parent's run. Streams numbered from a run log carry the parent run's own `index`; a plain in-process `agent.stream()` carries none.
