---
'@mastra/playground-ui': patch
---

Pointed the metrics drilldown links at `/traces` instead of `/observability`, matching Studio's traces route. Apps that pass their own `tracesBasePath` to the metrics provider are unaffected.
