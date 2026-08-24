---
'@mastra/core': patch
---

Added a `denied` flag to the agent controller `tool_end` event. Approval-denied tool calls and tools aborted while parked at an approval gate already emit `tool_end` with `isError: false` (the tool didn't fail — it never ran), which made them indistinguishable from a real successful completion. Subscribers that need to know whether the tool actually did work can now gate on `denied !== true`.
