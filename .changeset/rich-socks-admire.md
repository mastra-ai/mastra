---
'@mastra/observability': patch
---

Model inference spans now keep the provider response id, including requests cut off by a signal, an abort, or a timeout. Studio shows it, and the OpenTelemetry exporter sends it as `gen_ai.response.id`.
