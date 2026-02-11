---
'@mastra/lance': patch
---

Fixed Lance vector store failing when used with Memory's semantic recall. Queries on empty tables with metadata filters (e.g. resource_id, thread_id) now return empty results instead of throwing a schema error. Also fixed metadata round-trip corruption where flat underscore keys like resource_id were incorrectly reconstructed as nested objects.
