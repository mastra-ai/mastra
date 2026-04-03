---
'@mastra/core': patch
---

Fixed workspace file indexing to automatically chunk large files before embedding. Files exceeding the embedding model token limit were previously silently skipped, leaving the vector store empty and causing search failures. Large files are now split into overlapping line-based chunks, each indexed separately with correct line-range tracking back to the original file.
