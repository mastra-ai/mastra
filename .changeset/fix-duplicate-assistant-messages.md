---
'@mastra/core': patch
---

Fix duplicate assistant messages when using useChat

Prevents merging of assistant messages with different IDs when useChat resends message history with step-start metadata. Only enforces ID matching for messages retrieved from memory storage.
