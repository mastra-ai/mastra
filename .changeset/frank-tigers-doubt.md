---
'@mastra/code-sdk': patch
---

Fixed session thread cloning failing with "Source thread not found" when the cached dynamic memory instance was bound to a previous storage instance. The memory cache is now scoped to the storage it was created with.
