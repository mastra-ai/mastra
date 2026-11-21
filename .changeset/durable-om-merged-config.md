---
'@mastra/core': patch
---

Durable agents no longer treat a call-level `observationalMemory` opt-in as active when the Memory instance does not run observational memory, so such calls save their messages and generate the thread title like any other run.
