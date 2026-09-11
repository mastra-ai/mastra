---
'@mastra/temporal': patch
'@mastra/inngest': patch
'@mastra/core': patch
---

Evented workflows now persist the running step record and routing state before executing each step, so runs killed mid-step recover via restart() instead of failing with "Execution path is empty"
