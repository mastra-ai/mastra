---
'@mastra/core': patch
---

Fixed a thread's thinking level carrying over to another thread. Switching a session to a thread that never set a thinking level now clears the previous thread's level, so the run uses the configured default. A new thread still starts with the current thinking level and now keeps it when you switch away and back.
