---
'@mastra/observability': patch
---

fixed lost spans with default exporter
-exporter holds spans in memory until init calls are completed for a complete propogation
