---
'@mastra/core': patch
---

`DurableAgent.stream()`, `DurableAgent.generate()` and `EventedAgent` now take the thread before they read its history and persist the new user message, so a second message on the same thread waits for the live run to finish, matching plain `Agent`. When the thread's lease belongs to another process that this one has no run record for, the wait cannot see that run, and the message is rejected by the lease claim before it is written rather than saved and then rejected.
