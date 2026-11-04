---
'@mastra/core': patch
---

Fixed a stale tool-approval click in one chat thread aborting a live run in another thread when both threads share a controller session. The click is now treated as stale without switching the session's thread.
