---
'@mastra/core': patch
---

Fixed Slack channel messages so agents receive the text of Block Kit layout blocks (header, section, context, markdown), not just the notification fallback. Block-only messages now reach the agent. Thread history includes the block text too.
