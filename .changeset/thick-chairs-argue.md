---
'@mastra/memory': patch
---

Fixed observational memory re-embedding every earlier observation group on each cycle when vector retrieval is enabled. Each cycle now embeds and stores only the group it adds. Fixes https://github.com/mastra-ai/mastra/issues/27930.

Resource-scoped observational memory with vector retrieval now indexes new observations too. Before, nothing from those cycles reached the vector store.

If storing a group's vector fails, the next cycle in the same process tries it again.
