---
'@mastra/arize': patch
'@mastra/arthur': patch
'@mastra/langfuse': patch
'@mastra/otel-bridge': patch
---

Fixed traces failing to export from the Arize exporter after the recent OpenTelemetry upgrade.

The core OTLP exporter (`@mastra/otel-exporter`) was upgraded to the OpenTelemetry `0.219` / `2.8` line, but the Arize, Arthur, Langfuse, and OTel Bridge packages still pinned the older `0.218` / `2.7` line. That mismatch loaded two different copies of `@opentelemetry/sdk-trace-base`, so spans handed to the batch span processor were sent through a version that never delivered them. These packages now track the same OpenTelemetry versions as the core exporter, so trace export works again.
