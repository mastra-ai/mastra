---
'@mastra/ai-sdk': patch
---

Fixed start chunk being dropped when using toAISdkStream with partial options. The start message with messageId is now correctly emitted according to the AI SDK stream protocol.
