---
'@mastra/core': patch
---

Trace scorers and trajectories built from traces now skip usage-only model spans, so the model call of a processor is never read as a model call of the agent. Model span attributes have a new `usageOnly` flag that marks these spans.
