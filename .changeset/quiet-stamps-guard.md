---
'@mastra/server': patch
---

The memory save-messages route now removes the `mastra.modelOutputOrigin` marker from client-sent messages, so a client cannot mark a stored tool output as computed by the server.
