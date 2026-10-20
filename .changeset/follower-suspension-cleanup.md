---
'@mastra/core': patch
---

Fixed a Session that follows a thread keeping a tool call marked as pending after the run was resumed on another instance and completed. The follower now drops the answered call, so `suspensions.hasPending()` returns false and aborting no longer emits a spurious `tool_suspension_cancelled` event.
