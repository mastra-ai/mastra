---
'@mastra/core': patch
---

A follow-up message sent to a thread whose run is parked on a tool `suspend()` now starts the next turn instead of being queued onto the parked run, so `autoResumeSuspendedTools` can resume the suspended tool call.

Before, a message sent over the agent-signals path (Studio and the React `useChat` thread-signals transport, i.e. `POST /agents/:agentId/send-message`) was queued as a pending next-turn signal on the parked run and acknowledged as delivered. A run parked on a tool suspension never resumes on its own, and its completion watcher had already returned, so the queued message was never consumed: it was not written to thread history, no new model turn ran, and the workflow stayed suspended with no reply.

The parked run's thread reservation is now released for a same-agent follow-up the way a superseded parked run's is: the record stays resumable, but the thread is free, so the follow-up starts a fresh run and the loop's auto-resume rewrite sees the suspended tool call in the thread history. Approval suspensions are unchanged — the approval API finishes the run, and the queued message drains then.
