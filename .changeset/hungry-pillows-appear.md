---
'@mastra/memory': patch
---

Fixed observational memory overwriting incoming client tool results with older message history. Idle observation now buffers the safe completed message prefix while retaining incomplete client or provider tool calls and the messages after them. Raw messages are still saved, and completed tool results can be buffered on a later turn.
