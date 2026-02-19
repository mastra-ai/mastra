---
'@mastra/core': patch
---

Fixed sub-agent tool approval resume flow. When a sub-agent tool required approval and was approved, the agent would restart from scratch instead of resuming, causing an infinite loop. The resume data is now correctly passed through for agent tools so they properly resume after approval.
