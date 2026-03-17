---
'@mastra/ai-sdk': patch
---

Fixed type compatibility issue between `handleChatStream()` and `createUIMessageStreamResponse()` when using `ai@6`. The `FinishReason` type mismatch error no longer occurs when passing the stream from `handleChatStream()` to `createUIMessageStreamResponse()`.
