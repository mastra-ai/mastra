---
'@mastra/core': patch
---

Fixed a message sent to an agent missing from thread history while the agent works on it. A message sent with `sendMessage` (or a `user-message` signal sent with `sendSignal`) is now saved to the thread right before the model request that reads it, so reloading a chat mid-turn shows it. This covers the message that starts a run and messages sent while the run is working.

The message is not saved early when memory is read-only, when an input processor rejects it, or when the agent configures its own `MessageHistory` or observational memory processor. If the early save fails, the agent still answers, the save is retried before the next model request, and the turn saves the message as before.

A message saved this way stays in the thread when the model request that reads it then fails, so a chat can show the error next to it.
