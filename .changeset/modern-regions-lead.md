---
'@mastra/server': patch
---

Reduced memory and CPU use when streaming agent controller sessions. Each display-state update is now copied once per update instead of once per connected client, large strings such as message text and tool results are no longer duplicated in every copy, and the update is serialized once and shared by all clients of the session. Clients receive the same events as before. A display state containing a value that cannot be cloned, such as a function, no longer closes the stream.
