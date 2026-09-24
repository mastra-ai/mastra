---
'@mastra/core': patch
---

Fixed agent controller chat channels showing Approve/Deny buttons for tools that run or are blocked automatically. Channels now only show approval buttons when a person actually needs to decide (tools with an `ask` policy). Fixes #22379.
