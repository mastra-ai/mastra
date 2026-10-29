---
'@mastra/core': patch
'@mastra/memory': patch
---

Keep signed reasoning blocks when a conversation is rebuilt. A thinking block with a provider signature but no visible text now survives conversion. Observational memory also keeps the signed block of a tool call it is still holding open, so the call can be replayed without losing its signature.
