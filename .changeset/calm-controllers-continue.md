---
'@mastra/core': patch
---

Updated AgentController to preserve observational-memory failure diagnostics while allowing explicitly classified Observer/provider failures to continue when the memory policy requests it. Other observational-memory failures retain the existing request-abort behavior.
