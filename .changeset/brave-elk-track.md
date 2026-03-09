---
'@mastra/elasticsearch': patch
---

Added custom `user-agent` header to all Elasticsearch requests. Every request now identifies itself as `mastra-elasticsearch/<version>` via the `user-agent` header, enabling usage tracking in Elasticsearch server logs and analytics tools.
