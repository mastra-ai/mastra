---
'@mastra/core': patch
'mastracode': patch
---

Added a Unix socket PubSub transport and wired mastracode signals through a per-project socket so local sessions can coordinate thread streams across processes.
