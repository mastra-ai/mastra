---
'@mastra/braintrust': patch
'@mastra/sentry': patch
'@mastra/otel-exporter': patch
---

Fixed observability exporters to read toolCallId from span attributes (with metadata fallback). Braintrust Thread view now shows tool results by pairing them via the real tool call ID. Sentry and OTel exporters also pick up the ID consistently across all tool span types.
