---
'@mastra/observability': patch
---

Fixed telemetry spans being silently dropped when the default exporter was used. The exporter now holds spans in memory until initialization completes, ensuring all spans are propagated to your tracing backend.
