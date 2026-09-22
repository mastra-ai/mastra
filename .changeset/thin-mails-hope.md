---
'@mastra/core': patch
---

Fixed chat channel messages (Slack, Discord, etc.) silently disappearing when the agent failed during setup. If workspace, instructions, tools, or model resolution throws before the run starts, the error is now posted back to the chat thread instead of being dropped with no reply.
