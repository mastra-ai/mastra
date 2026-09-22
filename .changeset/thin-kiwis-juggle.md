---
'@mastra/server': minor
---

Added authenticated trace-query field and value discovery routes with distinct timeout and resource-limit responses.

```sh
curl -X POST http://localhost:4111/api/observability/traces/query/values \
  -H 'Content-Type: application/json' \
  -d '{"timeRange":{"from":"2026-08-01T00:00:00.000Z","to":"2026-08-02T00:00:00.000Z"},"predicateScope":"spans","path":"model"}'
```
