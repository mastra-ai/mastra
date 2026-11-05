---
'@mastra/inngest': patch
---

Inngest agent runs that finish on another connect worker now record their real span outcome (success, limit/max_steps, guardrail details) instead of unknown. A start request that fails to reach Inngest now ends the run's agent and model spans with that error.
