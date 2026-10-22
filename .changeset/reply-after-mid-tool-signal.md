---
'@mastra/core': patch
---

Fixed the agent's reply landing in the wrong message when a processor sends a signal while a tool is running. The reply used to be merged into the earlier assistant message that holds the tool call, so on the next turn the model saw its answer before the reminder it was answering. The reply is now stored as its own message after the signal, and history replays in the right order.
