---
'@mastra/core': patch
---

Durable agent runs that finish on another worker now record their real span outcome (success, limit/max_steps, guardrail with its processor id, delegation failure) instead of unknown. The loop state carries the termination cause between steps, so the result no longer depends on the process that started the run.
