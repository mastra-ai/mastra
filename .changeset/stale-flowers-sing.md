---
'@mastra/server': patch
---

Fixed A2A `tasks/list` returning the full message history when `historyLength` is 0. It now returns no history, as requested.
