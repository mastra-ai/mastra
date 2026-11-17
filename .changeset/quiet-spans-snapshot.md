---
'@mastra/observability': patch
---

Stop deep-copying span metadata twice for every logger and metrics context. `getLoggerContext` and `getMetricsContext` now pass span metadata straight to the context implementation, which snapshots it once, halving the deep copies taken on the agent execution path when observability is enabled.
