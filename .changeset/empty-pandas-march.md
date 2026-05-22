---
'mastracode': patch
---

Fixed slash commands so they run immediately while the agent is active instead of being queued, while message-sending slash commands still show pending UI until accepted.

Improved Ctrl+F follow-up queueing for slash commands and replaced synchronous git branch detection with an async version to reduce event loop blocking during streaming.
