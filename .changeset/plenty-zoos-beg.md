---
'@mastra/core': patch
---

Fixed agent-controller sessions failing, asking for stale approvals, or remaining busy when retained thread events replay already-resolved tool calls. Pending approvals and questions remain actionable across reconnects. Also fixed a race that could retire a suspended run before its tool-gate events finished broadcasting.
