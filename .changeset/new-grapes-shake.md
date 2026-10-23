---
'@mastra/core': patch
---

Fixed messages sent from another process to a busy agent thread waiting until the current run ended.

- **Messages join the running run:** a message delivered to a thread's claimed owner while it is running now reaches the run's next model request, the same as a message sent from the owner's own process.
- **Queued messages still wait:** messages queued with `queueSignal` or `queueMessage` still wait for the run to finish.
- **Both processes need this release:** a message joins the running run only when the sending process and the process that owns the thread both run this version. With an older sender or an older owner, it waits for the run to finish as before.
