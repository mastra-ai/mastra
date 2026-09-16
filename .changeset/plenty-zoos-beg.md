---
'@mastra/core': patch
---

Fixed agent-controller sessions failing with `sendToolApproval() could not find an active or suspended run for thread` right after subscribing to a thread whose previous run had already finished. Retained transports such as Redis Streams replay that run's `tool-call-approval` chunk to the new subscriber, and the run engine approved, denied or asked about it as if the run were still live. The engine now checks that the approval still has a run to resume and skips the chunk otherwise, using the same lookup `sendToolApproval()` relies on, exposed as `agent.findToolApprovalRun()`.
