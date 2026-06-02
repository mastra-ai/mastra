---
'@mastra/react': patch
---

Restored initial-message normalization in `useChat` that was lost in the `MastraDBMessage` refactor. On thread reload, persisted `pendingToolApprovals` (DB shape) are now converted back into `requireApprovalMetadata` (stream shape) with `mode: 'stream'`, filtering out approvals whose tool already produced output, so a thread paused on a tool approval again renders approve/decline buttons after a reload. Assistant completion messages flagged `suppressFeedback` (persisted by the supervisor agent) are now also filtered out of the initial load so they stay hidden, matching the prior behavior.
