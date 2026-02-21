---
'@mastra/memory': patch
---

Observations no longer inflate token counts from degenerate LLM output. Runaway or repetitive observer/reflector output is automatically detected and retried, preventing excessive context usage after activation.
