---
'@mastra/core': patch
---

Fixed durable agent runs that could not be resumed after a crash right after a tool suspended or asked for approval (#26435). The `tool-call-suspended` and `tool-call-approval` chunks are now published only after the suspended snapshot is saved, so a client that sees the question can always resume the run.

Detaching an `AgentController` session from a thread no longer declines and deletes a parked durable run, so another session or process can still resume it.
