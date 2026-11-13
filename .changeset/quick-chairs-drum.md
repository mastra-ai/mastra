---
'@mastra/core': patch
'@mastra/memory': patch
'@mastra/server': patch
---

User messages are stored as written. Before a message reaches the model, turn tags are escaped unless your server built the message with `asUserTurn`. A client cannot set that mark over HTTP.
