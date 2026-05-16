---
'@mastra/server': minor
'@mastra/client-js': patch
'mastra': patch
---

Added GET /observability/capabilities endpoint that reports which observability features the connected storage provider supports. The response includes the store class name and a boolean map keyed by storage method names (such as getEntityNames, getMetricAggregate, getTags). UIs can use this to disable or hide filters and panels that the connected store does not implement, rather than discovering unsupported features through 500 errors on the /observability/discovery/\* endpoints.
