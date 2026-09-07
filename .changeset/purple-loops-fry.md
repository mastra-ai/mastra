---
'@mastra/core': patch
---

Fixed durable agent error events arriving before final message history is saved. Session history read at agent_end now retains approved tool results when a later model call fails.
