---
'@mastra/server': minor
---

`GET /observability/traces/light` now accepts `mode=delta`, `after` and `limit`, matching `GET /observability/traces`. Previously those parameters were silently ignored, so a client trying to live-tail a lightweight list would refetch the first page on every poll.

```http
GET /observability/traces/light?mode=delta&after=<deltaCursor>&limit=100
```

The response contains the traces recorded since the cursor and a new `deltaCursor` for the next poll.
