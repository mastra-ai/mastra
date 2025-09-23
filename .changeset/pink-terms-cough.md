---
'@mastra/memory': patch
'@mastra/core': patch
'@mastra/pg': patch
---

Fix PostgreSQL vector index recreation issue and add optional index configuration

- Fixed critical bug where memory vector indexes were unnecessarily recreated on every operation
- Added support for configuring vector index types (HNSW, IVFFlat, flat) and parameters  
