---
'@mastra/core': patch
---

Fixed automatic tool resumption in the subscription transport: a follow-up message to a thread with a generic `context.agent.suspend()` suspension now starts a fresh run that auto-resumes the suspended tool from memory, instead of being silently queued onto the parked run (which never resumed). Explicit `Tool.requireApproval` gates are unaffected and still resume only through approve/decline.
