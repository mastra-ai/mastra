---
'@mastra/observability': patch
'@mastra/sentry': patch
'@mastra/datadog': patch
'@mastra/langsmith': patch
'@mastra/braintrust': patch
'@mastra/laminar': patch
'@mastra/otel-exporter': patch
---

Added PROVIDER_TOOL_CALL to exporter span-type mappings and duration metrics so provider-executed tool spans are classified as tool spans across all observability platforms.
