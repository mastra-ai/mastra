---
'@mastra/couchbase': patch
---

Support deleting multiple Couchbase vectors by ID with `deleteVectors()`. Missing IDs are ignored, while filter-based deletion remains unsupported.
