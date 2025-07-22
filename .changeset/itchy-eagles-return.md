---
'@mastra/pg': patch
---

Wrapped the query method logic inside of a transaction to ensure `SET LOCAL` works as expected -- properly sets the `hnsw.ef_search` value
