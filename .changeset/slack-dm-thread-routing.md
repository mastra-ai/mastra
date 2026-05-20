---
'@mastra/core': patch
---

Fix Slack DM threading so that each Slack thread maps to its own Mastra thread (including top-level DMs as their own conversation). Previously, replies and tool-approval clicks in a top-level DM could be routed into a sub-thread keyed by the bot's last message, causing follow-ups to thread under that message and tool approvals to fail to find the pending approval.
