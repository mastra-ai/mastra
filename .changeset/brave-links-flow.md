---
'@mastra/otel-exporter': patch
'@mastra/otel-bridge': patch
---

Span links are now sent as OpenTelemetry span links, so backends such as Jaeger and Grafana Tempo show which span in another trace a span is related to.
