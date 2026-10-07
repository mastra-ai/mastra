---
'@mastra/mongodb': patch
---

Fixed vector queries failing for a few seconds after a new index is created. While Atlas first builds a vector search index, a query can fail with "cannot query vector index ... while in state INITIAL_SYNC". `query` now retries across that window instead of throwing, which matters for a caller that queries an index straight after creating it, as semantic recall does on a fresh database.
