---
'@mastra/fastembed': patch
---

Fixed embeddings failing with "Config file not found" when the model cache folder is removed, or the home directory changes, while a process is running. The cache folder is now looked up each time a model loads instead of once per process.
