---
'@mastra/couchbase': patch
---

Support deleting multiple Couchbase vectors by ID with `deleteVectors()`. For example, `await store.deleteVectors({ indexName: 'my_index', ids: ['vec_1', 'vec_2'] })`. Missing IDs are ignored, while filter-based deletion remains unsupported.
