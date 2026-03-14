---
'@mastra/ai-sdk': patch
---

Fixed type mismatch between `handleChatStream()` and `createUIMessageStreamResponse()` when using `ai@6`. The published `.d.ts` files now import types from the user's installed `ai` package instead of embedding vendored types from `ai@5`, which had an incompatible `FinishReason` definition.
