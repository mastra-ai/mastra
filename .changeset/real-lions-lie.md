---
'@mastra/factory': patch
'@mastra/code-sdk': patch
---

Fixed cloned session threads reading from a previous storage instance. The dynamic memory cache now invalidates when the storage or vector instance changes, so thread cloning always uses the current database.
