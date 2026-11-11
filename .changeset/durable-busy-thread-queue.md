---
'@mastra/core': patch
---

Fixed durable and evented agents mishandling a second message sent while the thread is still answering. A second `stream()` or `generate()` call on a busy thread now waits for the active run to finish, as it does on a plain `Agent`, so the reply sees the earlier answer and the thread history stays in order. Evented agents on a shared transport that can't take the thread now reject the run before its message is saved. Previously that left an unanswered user message in the thread.
