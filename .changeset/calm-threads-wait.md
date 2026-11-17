---
'@mastra/libsql': patch
---

Fixed thread state writes failing with `SQLITE_BUSY` while another write is in progress on a local database file. Setting or clearing a thread's state, such as an agent's goal objective, now waits for that write to finish.
