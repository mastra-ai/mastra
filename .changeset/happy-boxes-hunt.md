---
'@mastra/core': patch
---

Fixed agents that resolve their model, instructions, or memory from request context failing to run when a signal wakes a thread whose claimed owner runs on another server. The caller's request context now travels with the wake, without the auth token or values that can't be sent as JSON, so the woken run resolves the same way it would locally. This covers background-task finish reports, schedules, and notifications delivered to a claimed owner.
