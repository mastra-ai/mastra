---
'@mastra/core': patch
---

Improved the default goal judge's structured-output retry by placing JSON instructions in the latest user message. The first attempt still uses automatic capability-based routing, strict validation remains enabled, and other scorers retain their existing fallback behavior.
