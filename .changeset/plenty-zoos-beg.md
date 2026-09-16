---
'@mastra/core': patch
---

Fixed agent-controller sessions acting on tool gates replayed from runs that had already finished. Retained transports such as Redis Streams replay a thread's earlier runs to a session that subscribes later; the run engine treated every replayed `tool-call-approval` and `tool-call-suspended` chunk as live, so a session could fail with `sendToolApproval() could not find an active or suspended run for thread`, prompt for an approval nobody could grant, or park itself on a question that had already been answered elsewhere. The engine now checks that the gate still has a run to resume and skips the chunk otherwise, using the lookup `sendToolApproval()` already relied on, exposed as `agent.findThreadRunToResume()`.
