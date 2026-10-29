---
'@mastra/core': patch
---

Keep signed reasoning blocks when a conversation is rebuilt. A thinking block that carries a provider signature but no visible text now survives conversion, so it can be replayed to the provider as-is.
