---
'@mastra/core': patch
'@mastra/inngest': patch
---

Fixed Inngest durable agents still writing to memory after `modelSettings.timeout.totalMs` expired when a step ran on a different Inngest worker than the one that started the run. The deadline now travels with the run to every worker, so any step past it refuses to save.

A save that passed the deadline check just before the deadline but reached storage after it is now rejected too, on memory stores that support run fencing (including LibSQL, PostgreSQL and the in-memory store). This needs two things: the run fence was raised when the run started (a warning is logged if it could not be), and the process that started the run is still alive at the deadline to raise the newer fence. If either is missing, such a save can still land on these stores. On other stores, steps check the deadline before saving, and a save already in progress at the deadline can still land. The accepted user message is still saved.
