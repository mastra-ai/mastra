---
'@mastra/core': patch
---

Fixed message ID mismatch between generate/stream response and memory-stored messages. When an agent used memory, the message IDs returned in the response (e.g. `response.uiMessages[].id`) could differ from the IDs persisted to the database. This was caused by a format conversion that stripped message IDs during internal re-processing. Messages now retain their original IDs throughout the entire save pipeline.
