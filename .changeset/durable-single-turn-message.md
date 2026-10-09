---
'@mastra/core': patch
---

Fixed durable and evented agents storing a multi-step turn as one assistant message per step. A turn now persists as a single assistant message with `step-start` separators, matching the default agent loop, so `lastMessages` windows and the streamed `start.messageId` line up with stored history.
