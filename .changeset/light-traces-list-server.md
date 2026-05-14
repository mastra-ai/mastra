---
"@mastra/core": patch
"@mastra/server": patch
---

Expose `GET /observability/traces/light` from the OSS server and storage layer to fetch paginated trace-list rows without span payload data.
