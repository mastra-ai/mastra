---
'@mastra/core': patch
---

Fixed durable agents running the model call outside the model step span context. `getCurrentSpan()` inside AI SDK model middleware and span-correlated logs now resolve to the model span for durable agents, matching regular agents.
