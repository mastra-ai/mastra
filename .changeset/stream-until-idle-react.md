---
'@mastra/react': patch
---

The agent hook now supports `streamUntilIdle`, keeping the stream open through background task completion and the follow-up agent turn so the UI receives the final answer without another user message. Background-task metadata on UI messages is now keyed by `toolCallId` so multiple concurrent tool calls don't overwrite each other's status/timing, and historical tool parts are updated in place when their background task completes.
