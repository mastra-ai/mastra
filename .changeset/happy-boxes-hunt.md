---
'@mastra/core': patch
---

Fixed agents that resolve their model, instructions, or memory from request context failing to run when a signal wakes a thread whose claimed owner runs on another server. The caller's request context now travels with the wake, without the auth token or values that can't be sent as JSON, so the woken run resolves the same way it would locally. This covers background-task finish reports, schedules, and notifications delivered to a claimed owner.

A claimed owner woken by a signal now always runs and saves on its own thread and resource, even when the caller's request context names another thread. It also keeps its own auth token when it has one.

Background-task finish reports are more reliable:

- A request context that a tool transformed with its `requestContextSchema` is passed to the woken run in its original input form, so the run no longer fails validation.
- When a suspended run's leftover lease briefly blocks the thread, the report waits for the lease to clear instead of being dropped.
