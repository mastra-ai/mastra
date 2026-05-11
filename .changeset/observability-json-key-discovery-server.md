---
'@mastra/server': minor
---

Added two observability discovery endpoints that return the distinct top-level keys present on JSON columns of observability records:

- `GET /observability/discovery/root-span-keys?field=metadata|attributes`
- `GET /observability/discovery/log-keys?field=metadata|data`

Both return `{ keys: string[] }`.
