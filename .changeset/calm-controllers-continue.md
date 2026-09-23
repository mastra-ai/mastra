---
'@mastra/core': patch
---

Added `maxRetries` and `failurePolicy` to the observational-memory `observation` and `reflection` config types, and updated AgentController to preserve observational-memory failure diagnostics while allowing explicitly classified Observer and Reflector model failures to continue when the memory policy requests it. Unclassified observational-memory failures retain the existing request-abort behavior.
