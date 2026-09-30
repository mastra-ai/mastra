---
'@mastra/core': patch
---

Reduced durable agent snapshot size by no longer saving the agent's system prompt on every step. Resume, tool approval, and trace rebuilds still use the copy kept in the run input, so behavior and traces are unchanged.
