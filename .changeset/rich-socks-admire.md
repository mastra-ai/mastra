---
'@mastra/observability': patch
---

Model inference spans now keep the provider response id, including requests that a signal cuts off. Studio shows it, and the OpenTelemetry exporter sends it as `gen_ai.response.id`.
