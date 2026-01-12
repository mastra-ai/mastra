---
'@mastra/otel-exporter': patch
'@mastra/braintrust': patch
'@mastra/langsmith': patch
'@mastra/langfuse': patch
'@mastra/posthog': patch
'@mastra/observability': patch
'@mastra/arize': patch
'@mastra/core': patch
---

Fixed CachedToken tracking in all Observability Exporters. Also fixed TimeToFirstToken in Langfuse, Braintrust, PostHog exporters. Fixed trace formatting in Posthog Exporter.
