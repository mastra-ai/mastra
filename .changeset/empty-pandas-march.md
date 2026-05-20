---
'mastracode': patch
---

Slash commands now run immediately while the agent is active instead of being queued. Use Ctrl+F to explicitly queue follow-up messages. Also replaced synchronous git branch detection with an async version to reduce event loop blocking during streaming.
