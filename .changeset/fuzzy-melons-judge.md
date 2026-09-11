---
'@mastra/temporal': patch
'@mastra/inngest': patch
'@mastra/core': patch
---

EventedAgent tool-approval, tool-denial, and in-execution resume no longer fail with "Cannot read properties of undefined (reading 'messages')": the evented engine retains running conversation history in persisted agent-loop snapshots, since its storage-merged step results are live data (unlike the default engine's write-only snapshots)
