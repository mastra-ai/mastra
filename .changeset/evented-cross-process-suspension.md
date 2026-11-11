---
'@mastra/core': patch
---

Fixed evented agents losing the assistant message of a run that paused on a tool when workers run in more than one process. With a step-guarded store (such as Postgres) and a shared PubSub (such as Redis Streams), the tool step can run in a different process from the model step. That process did not have the assistant message, so the thread kept only the user message and `suspendedTools` / `pendingToolApprovals` were never saved. Pending questions now survive a reload and `autoResumeSuspendedTools` can find them.
