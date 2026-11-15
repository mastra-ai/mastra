---
'@mastra/couchbase': patch
---

Couchbase vector queries now log a warning the first time a metadata filter is passed. Couchbase vector search can't narrow results by metadata, so the filter is ignored, as before. The warning makes that visible instead of silent.
