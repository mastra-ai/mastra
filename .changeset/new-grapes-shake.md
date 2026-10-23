---
'@mastra/core': patch
---

Fixed messages sent from another process to a busy agent thread waiting until the current run ended. A message delivered to a thread's claimed owner while it is running now reaches the run's next model request, the same as a message sent from the owner's own process, instead of starting a new run once the current one finishes. Messages queued with `queueSignal` or `queueMessage` still wait for the run to finish.
