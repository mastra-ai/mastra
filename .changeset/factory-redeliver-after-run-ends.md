---
'@internal/mastra-factory': patch
---

Wait for the run that swallowed a kickoff, instead of racing it.

A signal queued onto an already-running turn can be dropped when that turn ends
before draining its queue. That case was detected correctly and then handed to
the generic exponential backoff, which spends all five attempts inside about
thirty seconds — while the run it is waiting on takes minutes. Every attempt
landed on the same busy session and the card gave up roughly ten times too early.

The dispatcher now waits for the in-flight run to end and redelivers into the
freed session, which is the event that actually resolves the condition. The
decision settles within its original lease without spending the retry budget, and
a redelivery that is dropped again still goes back on the queue.
