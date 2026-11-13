---
'@mastra/core': patch
---

Fixed an agent reply being saved into the wrong message after a signal arrives while a tool is running. If a processor sent a signal (for example, a background reminder) during tool execution, the model's next reply was merged into the earlier assistant message with the tool call. On the next turn, the model then saw its reply placed before the reminder it was answering. The reply is now saved as its own assistant message after the signal. When no signal arrives, nothing changes: the tool call and reply stay in one message.
