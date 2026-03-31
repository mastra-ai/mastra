---
'@mastra/core': patch
---

Fixed incorrect type cast for sub-agent context messages. The context option for new API methods (generate, stream, resumeGenerate, resumeStream) now correctly casts to ModelMessage[] instead of CoreMessage[].
