---
'@mastra/core': patch
'@mastra/memory': patch
---

Keep signed reasoning blocks when rebuilding a conversation. A thinking block that carries a provider signature but no visible text is now replayed instead of dropped, and observational memory keeps the signed block of a tool call it is still holding open, so providers no longer lose the signature and re-bill the whole prompt.
