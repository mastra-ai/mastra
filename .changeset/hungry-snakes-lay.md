---
'@mastra/core': minor
'mastracode': patch
---

Added signal delivery attributes API (`deliveryAttributes` on `AgentSignalInput`) that conditionally merges attributes based on whether a signal is delivered to an active agent run (`ifActive`) or an idle run (`ifIdle`). This enables contextual signal delivery — for example, tagging user messages as interjections when the agent is actively working.
