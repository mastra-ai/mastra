---
'@mastra/core': patch
---

Fixed a second message sent to a thread that already has a live durable or evented run. Both agents used to persist the new user message and start a second run before either run registered on the thread, so the thread's saved order became `user, user, assistant, assistant` and each reply could be attributed to the wrong prompt. `DurableAgent.stream()`, `DurableAgent.generate()` and `EventedAgent` now take the thread before they read its history and persist the new user message, so a second message on the same thread waits for the live run to finish, matching plain `Agent`. When the thread's lease belongs to another process that this one has no run record for, the wait cannot see that run, and the message is rejected by the lease claim before it is written rather than saved and then rejected. Fixes [#30069](https://github.com/mastra-ai/mastra/issues/30069).
