---
'@mastra/react': patch
---

`useChat` now handles `tool-call-resumed` chunks. It clears the matching suspended tool or pending approval, and `isAwaitingToolApproval` becomes `false` once no paused tool calls remain in the resumed run.
