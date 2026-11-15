---
'@mastra/couchbase': patch
---

Couchbase vector queries now reject a metadata filter instead of ignoring it. Couchbase vector search cannot narrow results by metadata, so a query with a filter used to return results the filter should have excluded. Queries without a filter, or with an empty one, work as before.
