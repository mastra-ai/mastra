---
'@mastra/core': patch
---

Fixed resourceId not being forwarded to createRun() in the agentic loop, which caused persistWorkflowSnapshot to receive resourceId: undefined.
