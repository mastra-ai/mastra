---
'@mastra/core': patch
---

Fixed a memory leak where agents with sub-agents, workflows, or `autoResumeSuspendedTools` kept growing the heap on every tool conversion (each `generate`/`stream` call and agent listing). Resume fields injected into tool input schemas are now created once instead of per conversion, so they no longer pile up in Zod's global schema registry when `zod@3.25.x` is installed. Fixes #26160.
