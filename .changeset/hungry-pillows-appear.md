---
'@mastra/memory': patch
---

Fixed observational memory overwriting incoming client tool results with older message history. Idle observation now waits for incomplete client or provider tool calls to finish, while raw messages are still saved.
