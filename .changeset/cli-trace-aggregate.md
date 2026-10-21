---
'mastra': minor
---

Added the `mastra api trace aggregate` command for grouped observability trace measures such as counts, error rates, duration percentiles, tokens, and cost, optionally bucketed by time.

```bash
mastra api trace aggregate '{"timeRange":{"from":"2026-08-01T00:00:00.000Z","to":"2026-08-08T00:00:00.000Z"},"groupBy":["entityName"],"measures":["count","errorRate"]}'
```
