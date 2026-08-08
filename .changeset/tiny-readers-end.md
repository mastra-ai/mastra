---
'@mastra/ai-sdk': patch
---

Fixed the finish reason dropping out of AI SDK UI message streams. The final `finish` chunk from `handleChatStream` and `toAISdkStream` now carries `finishReason`, so clients can tell `stop`, `length`, `content-filter`, `tool-calls` and `other` apart. This matches the AI SDK behavior. Fixes #20562.
