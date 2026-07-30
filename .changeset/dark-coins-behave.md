---
'@mastra/core': patch
---

Fixed agent schedules targeting stored agents being permanently deleted after a server restart. Both deletion paths are covered: the scheduler tick loop no longer counts an unhydrated stored agent as a missing target (it confirms absence against the editor before reclaiming the schedule row), and the fire path resolves stored agents through the editor before self-cleaning. Schedules are never deleted when the editor lookup fails transiently — only a confirmed miss from both the registry and the editor reclaims the row.
