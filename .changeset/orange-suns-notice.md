---
'@mastra/server': minor
---

Added `POST /observability/spans/query`, which returns one row per completed span that matches a span filter, with cursor pagination. Use it to list spans across traces, for example every failed tool call in a time range.

```http
POST /api/observability/spans/query
Content-Type: application/json

{
  "timeRange": { "from": "2026-10-01T00:00:00Z", "to": "2026-10-02T00:00:00Z" },
  "where": { "op": "eq", "left": { "path": "spanType" }, "right": { "literal": "tool_call" } },
  "page": { "limit": 50 }
}
```

The endpoint requires the `observability:read` permission and uses the same error contract as `POST /observability/traces/query`. Observability stores that do not support span queries return 501 with code `SPAN_QUERY_UNSUPPORTED`.

`GET /observability/capabilities` and `GET /system/packages` now report a `spanQuery` capability, so clients can check support before they call the endpoint.
