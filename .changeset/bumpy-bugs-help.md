---
'@mastra/core': patch
---

Fixed messages sent with `sendMessage` not appearing in thread history while the agent works on them. Before, the message was saved only when the turn ended, or with observational memory, at the agent's second model request, so reloading a chat during a long first step showed an empty conversation. The message (or a `user` signal sent with `sendSignal`) is now saved right before the model request that reads it, including messages sent while the run is already working.

The early save is skipped when memory is read-only, when an input processor rejects the message, when the agent configures its own `MessageHistory` or observational memory processor, and when the Mastra gateway manages memory for the model. If the early save fails, the agent still answers and the message is saved at the next model request or with the turn.
