---
'@mastra/spanner': patch
'@mastra/oracledb': patch
---

The observability store now declares which optional observability features it supports, so Studio only shows what works. Spanner reports metrics and metric discovery only when `disableMetrics: false` is set. Oracle reports logs and filter discovery.
