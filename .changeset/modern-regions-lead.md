---
'@mastra/server': patch
---

Reduced memory and CPU use when clients stream agent controller sessions. Each display-state update is now copied and serialized once and shared by every client of the session, instead of once per client, and the copy no longer duplicates message text or tool results. Clients receive the same bytes as before. A display state holding a value that cannot be cloned, such as a function, no longer closes the stream.
