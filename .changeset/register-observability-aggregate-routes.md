---
'@mastra/server': patch
---

Registered missing observability score and feedback aggregate routes. The handlers for `scores/aggregate`, `scores/breakdown`, `scores/timeseries`, `scores/percentiles` and their feedback counterparts were defined but not wired into the server route array, resulting in 404s.
