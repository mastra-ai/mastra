---
'@mastra/core': patch
---

Fixed workspace file indexing so vector search works out of the box.

- Large files that exceeded the embedding model token limit were previously silently skipped, leaving the vector store empty and causing search failures. Large files are now split into overlapping line-based chunks, each indexed separately with correct line-range tracking back to the original file.
- The vector index is now created automatically before the first upsert. Previously, backends that require an explicit `createIndex` call (e.g. LibSQL) would leave the table uncreated, causing `no such table` errors on search. Workspaces with `vectorStore` + `embedder` + `autoIndexPaths` configured now work without any manual setup.
