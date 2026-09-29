---
'@mastra/core': patch
---

Fixed generated thread titles re-creating a thread that was deleted while the title was still being generated. Deleted threads now stay deleted, and the title save no longer overwrites thread metadata that changed during generation.
