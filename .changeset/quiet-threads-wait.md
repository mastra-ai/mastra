---
'@mastra/core': patch
---

Fixed agents failing with "No thread found" on the first message of a new thread when `ToolSearchProcessor` stores loaded tools in context (`storage: 'context'`). The agent no longer reads history for a thread that hasn't been created yet, so new chats and eval runs no longer fail before the model is called.
