---
'@mastra/core': patch
---

Fixed agent response message getting a stale createdAt that placed it before recent input messages in long conversations, which caused MessageList to mis-sort the transcript and the model to re-issue tool calls on the next step. Regression introduced in 1.35.0. Fixes https://github.com/mastra-ai/mastra/issues/16893.
