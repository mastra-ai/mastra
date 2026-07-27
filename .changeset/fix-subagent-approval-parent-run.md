---
'@mastra/core': patch
---

Fixed sub-agent tool approvals resuming the wrong run. When a sub-agent suspends for approval and the bot restarts, the approval handler now correctly resumes the parent agent's run instead of the sub-agent's.
