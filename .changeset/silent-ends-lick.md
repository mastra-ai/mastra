---
'@mastra/core': patch
---

Add `resumeGenerate` method for resuming agent via generate
Add `runId` and `suspendPayload` to fullOutput of agent stream
Default `suspendedToolRunId` to empty string to prevent `null` issue
