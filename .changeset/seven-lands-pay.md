---
'@mastra/core': patch
---

Fixed channel tool approvals for sub-agents after a server restart. When a parent agent delegates to a sub-agent whose tool has `requireApproval: true`, clicking Approve or Deny on the channel card (Slack, Telegram, Discord) after a restart — including on serverless platforms where every click hits a fresh instance — previously failed with `AGENT_RESUME_TOOL_CALL_NOT_SUSPENDED` because the persisted approval metadata only stored the sub-agent's run. The metadata now also records the parent run, and channel approval clicks resume through it. Fixes #16861.
