---
'@mastra/core': patch
---

Fixed a second message sent to a thread that already has a live durable or evented run. Both agents used to persist the new user message and start a second run before either run registered on the thread, so the thread's saved order became `user, user, assistant, assistant` and each reply could be attributed to the wrong prompt. `DurableAgent.stream()`, `DurableAgent.generate()` and `EventedAgent` now reserve the thread before they read the thread's history and persist the new user message, so the second message waits for the live run to finish — matching plain `Agent`. An evented run that loses the thread lease to another process is now rejected before its user message is written, instead of rejecting after saving it. Fixes [#30069](https://github.com/mastra-ai/mastra/issues/30069).
