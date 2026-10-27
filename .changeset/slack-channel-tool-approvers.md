---
'@mastra/core': minor
'@mastra/slack': minor
---

Added opt-in shared-channel tool approvals while keeping requester-only approval as the default. Configure `new SlackProvider({ toolApprovers: 'anyone' })` to allow channel members to approve or deny pending tools.
