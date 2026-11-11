---
'@mastra/inngest': patch
'@mastra/core': patch
---

Fixed `streamUntilIdle()` on agents created with `createInngestAgent` closing right after `background-task-completed`. When a deferred background task finishes while an until-idle stream is open, the follow-up answer now streams on that same stream instead of waking the thread as a separate run that only reaches memory.
