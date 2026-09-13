---
'@mastra/memory': patch
---

Fixed observational memory overwriting incoming client tool results with older message history. Idle observation now buffers completed messages when the newest unobserved message holds an incomplete client or provider tool call, as long as the boundary is safe; an abandoned call buried under newer messages no longer stalls buffering. If the boundary is unsafe, the buffer attempt is deferred instead. Raw messages are still saved, and completed tool results can be buffered on a later turn. Mid-loop step-time buffering (`bufferTokens`) now admits the same safe completed prefix instead of deferring the whole batch while a call is pending.
