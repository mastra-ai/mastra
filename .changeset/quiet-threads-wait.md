---
'mastra': patch
---

Fixed new Factory sessions showing "Failed to load messages: Thread not found" while the session's environment is still starting. The session shows an empty history until it is ready, then loads it, including after a page reload.
