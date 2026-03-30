---
'@mastra/server': minor
---

Added public observability endpoints for score and feedback analytics, including `/observability/scores/aggregate`, `/observability/scores/breakdown`, `/observability/scores/timeseries`, `/observability/scores/percentiles`, and matching `/observability/feedback/*` routes for aggregates, breakdowns, time-series, and percentile queries.

```bash
curl -X POST /observability/scores/aggregate \
  -H 'content-type: application/json' \
  -d '{"scorerId":"relevance","aggregation":"avg"}'
# {"value":0.82}
```
