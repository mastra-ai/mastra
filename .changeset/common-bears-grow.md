---
'@mastra/core': patch
---

Fixed delegated tool approvals not resuming after a page refresh or server restart. Approvals saved in conversation metadata previously pointed at a sub-agent run that could not be resumed. They now point at the supervisor run, so the saved approval works directly with `resumeStream()` and `approveToolCall()`. Approvals saved before this fix keep working.
