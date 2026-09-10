---
'@mastra/memory': patch
---

Fixed observational memory overwriting incoming client tool results with older message history. Idle observation now buffers completed messages before the first incomplete client or provider tool call when that boundary is safe. Otherwise, it defers the idle-buffer attempt. Raw messages are still saved, and completed tool results can be buffered on a later turn.
