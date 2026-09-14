---
'@mastra/core': patch
---

Fixed a stuck agent run when a message is sent immediately after aborting. Calling `abort()` (or `steer()`) and sending another message right away now correctly starts a fresh, observable run instead of losing its start/end events and leaving the session stuck in a running state.
