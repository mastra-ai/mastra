---
'@mastra/observability': patch
---

Improved auto-extracted model token metrics to preserve cost context from model generation spans.

When a model generation span already includes an estimated cost, observability now attaches that cost to the emitted token metric instead of recalculating pricing from token counts. This lets storage-backed metric queries and dashboards display costs supplied by upstream integrations.
