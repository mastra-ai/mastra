---
'@mastra/core': patch
---

Durable agents now store a multi-step turn as one assistant message with `step-start` parts between steps, the same as `Agent`. Before, each step was saved as its own assistant message, which used up extra `lastMessages` slots and made the streamed `messageId` match only the first stored message (#26332).
