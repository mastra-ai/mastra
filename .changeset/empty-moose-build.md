---
'@mastra/server': minor
---

Added `POST /observability/spans/aggregate`, which groups and measures individual spans (counts, durations, error rates, tokens, cost) over a time window. `GET /observability/capabilities` now reports `spanAggregate`; the route returns 501 when the configured observability store does not support span aggregation.

`POST /api/observability/spans/aggregate`:

```json
{
  "timeRange": { "from": "2026-10-01T00:00:00Z", "to": "2026-10-08T00:00:00Z" },
  "where": { "op": "eq", "left": { "path": "spanType" }, "right": { "literal": "agent_run" } },
  "groupBy": ["status"],
  "interval": "1d",
  "measures": ["count"]
}
```
