---
'@mastra/otel-bridge': minor
'@mastra/datadog': minor
---

Bridges now report whether a created span's parent is a Mastra span or an external one, so runs that start under an external parent are recorded as trace roots in Mastra Studio.
