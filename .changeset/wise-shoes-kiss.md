---
'@mastra/core': patch
---

Fixed channel tool approvals being ignored after `AgentChannels` is rebuilt or the bot restarts. Clicking Approve or Deny on a card now works even when more than 50 messages were posted in the thread after the approval was requested, and only the user who triggered the tool can still answer it. Repeated clicks on the same card reuse the first lookup instead of reading the thread again, and an approval can no longer be answered twice. Fixes [#29186](https://github.com/mastra-ai/mastra/issues/29186).
