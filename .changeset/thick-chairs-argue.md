---
'@mastra/memory': patch
---

Fixed synchronous observation re-embedding every earlier observation group on each cycle when vector retrieval is enabled. Each cycle now embeds and stores only the group it adds. Fixes https://github.com/mastra-ai/mastra/issues/27930.
